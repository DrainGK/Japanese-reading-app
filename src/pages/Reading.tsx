import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { passages } from '../data/passages';
import { useSession } from '../hooks/useSession';
import { StorageService } from '../services/storage';
import { ReadingPassage, WaniKaniData, WaniKaniSubject } from '../types';
import { getMatchingVocabularyTokens } from '../lib/passageMatching';
import { PopupWordInfo, WordPopup } from '../components/WordPopup';

type HighlightSets = {
  kanji: Set<string>;
  vocab: Set<string>;
  kanjiInfo: Map<string, PopupWordInfo>;
  vocabInfo: Map<string, PopupWordInfo>;
};

type ReadingMode = 'reading' | 'study';

function toPopupInfo(subject: WaniKaniSubject, srsStage?: number): PopupWordInfo {
  return {
    token: subject.data.characters ?? subject.data.slug,
    type: subject.type === 'kanji' ? 'kanji' : 'vocab',
    meanings: subject.data.meanings.map((item) => item.meaning),
    readings: (subject.data.readings ?? []).map((item) => item.reading),
    level: subject.data.level,
    srsStage,
  };
}

function buildHighlightSets(passage: ReadingPassage, data: WaniKaniData | null): HighlightSets {
  if (!data) {
    return {
      kanji: new Set(),
      vocab: new Set(),
      kanjiInfo: new Map(),
      vocabInfo: new Map(),
    };
  }

  const wkKanji = new Set<string>();
  const wkVocab = new Set<string>();
  const kanjiInfo = new Map<string, PopupWordInfo>();
  const vocabInfo = new Map<string, PopupWordInfo>();

  data.assignments.forEach((assignment) => {
    const subject = data.subjects.get(assignment.data.subject_id);
    if (!subject) return;

    if (subject.type === 'kanji' && subject.data.characters) {
      if (passage.kanjiList.includes(subject.data.characters)) {
        wkKanji.add(subject.data.characters);
        kanjiInfo.set(subject.data.characters, toPopupInfo(subject, assignment.data.srs_stage));
      }
      return;
    }

    if (subject.type === 'vocabulary' || subject.type === 'kana_vocabulary') {
      const token = subject.data.characters ?? subject.data.slug;
      if (token) {
        wkVocab.add(token);
        vocabInfo.set(token, toPopupInfo(subject, assignment.data.srs_stage));
      }
    }
  });

  const matchedVocab = getMatchingVocabularyTokens(passage.text, wkVocab);
  const filteredVocabInfo = new Map<string, PopupWordInfo>();
  matchedVocab.forEach((token) => {
    const info = vocabInfo.get(token);
    if (info) {
      filteredVocabInfo.set(token, info);
    }
  });

  return {
    kanji: new Set(passage.kanjiList.filter((kanji) => wkKanji.has(kanji))),
    vocab: matchedVocab,
    kanjiInfo,
    vocabInfo: filteredVocabInfo,
  };
}

function renderParagraphWithHighlights(
  paragraph: string,
  showHighlights: boolean,
  sets: HighlightSets,
  interactive: boolean,
  onSelectWord: (word: PopupWordInfo) => void
): Array<string | JSX.Element> {
  if (!showHighlights) {
    return [paragraph];
  }

  const nodes: Array<string | JSX.Element> = [];
  const vocabTokens = Array.from(sets.vocab).sort((a, b) => b.length - a.length);

  let index = 0;
  let keyIndex = 0;

  while (index < paragraph.length) {
    const vocabMatch = vocabTokens.find((token) => paragraph.startsWith(token, index));
    if (vocabMatch) {
      const vocabWord = sets.vocabInfo.get(vocabMatch);
      nodes.push(
        <span
          key={`vocab-${keyIndex++}`}
          className="highlight-vocab"
          onClick={() => interactive && vocabWord && onSelectWord(vocabWord)}
          role={interactive ? 'button' : undefined}
          tabIndex={interactive ? 0 : undefined}
          onKeyDown={(event) => {
            if (!interactive || !vocabWord) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelectWord(vocabWord);
            }
          }}
        >
          {vocabMatch}
        </span>
      );
      index += vocabMatch.length;
      continue;
    }

    const char = paragraph[index];
    if (sets.kanji.has(char)) {
      const kanjiWord = sets.kanjiInfo.get(char);
      nodes.push(
        <span
          key={`kanji-${keyIndex++}`}
          className="highlight-kanji"
          onClick={() => interactive && kanjiWord && onSelectWord(kanjiWord)}
          role={interactive ? 'button' : undefined}
          tabIndex={interactive ? 0 : undefined}
          onKeyDown={(event) => {
            if (!interactive || !kanjiWord) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelectWord(kanjiWord);
            }
          }}
        >
          {char}
        </span>
      );
    } else {
      nodes.push(char);
    }

    index += 1;
  }

  return nodes;
}

export function ReadingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, startSession, startTimer, resetSession } = useSession();
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [mode, setMode] = useState<ReadingMode>('study');
  const [showHighlights, setShowHighlights] = useState(true);
  const [selectedWord, setSelectedWord] = useState<PopupWordInfo | null>(null);
  const [highlightSets, setHighlightSets] = useState<HighlightSets>({
    kanji: new Set(),
    vocab: new Set(),
    kanjiInfo: new Map(),
    vocabInfo: new Map(),
  });

  const passage = passages.find((p) => p.id === id);

  useEffect(() => {
    let active = true;

    const loadHighlights = async () => {
      if (!passage) return;

      const wkData = await StorageService.getWaniKaniData();
      if (!active) return;

      setHighlightSets(buildHighlightSets(passage, wkData));
    };

    void loadHighlights();

    return () => {
      active = false;
    };
  }, [passage]);

  useEffect(() => {
    if (!passage) {
      navigate('/');
      return;
    }

    if (!session.passage) {
      startSession(passage);
    }
  }, [passage, session.passage, startSession, navigate]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (session.isTimerRunning && session.timeStarted) {
      interval = setInterval(() => {
        setTimeElapsed(Math.floor((Date.now() - session.timeStarted!) / 1000));
      }, 100);
    }

    return () => clearInterval(interval);
  }, [session.isTimerRunning, session.timeStarted]);

  if (!passage || !session.passage) {
    return <div className="text-center py-12">Loading...</div>;
  }

  const handleStartQuestions = () => {
    navigate(`/questions/${passage.id}`);
  };

  const handleBack = () => {
    resetSession();
    navigate('/');
  };

  const minutes = Math.floor(timeElapsed / 60);
  const seconds = timeElapsed % 60;
  const estimatedSeconds = passage.estimatedMinutes * 60;
  const paceRatio = estimatedSeconds > 0 ? timeElapsed / estimatedSeconds : 0;

  const isStudyMode = mode === 'study';
  const canInteractHighlights = isStudyMode && showHighlights;

  const getPace = (ratio: number): { label: string; color: string } => {
    if (ratio < 0.8) return { label: 'Ahead of pace', color: 'text-success-500' };
    if (ratio < 1.2) return { label: 'On pace', color: 'text-prose-muted' };
    return { label: 'Take your time', color: 'text-warning-500' };
  };

  return (
    <div className="space-y-5">
      {/* Header with Timer */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          className="text-primary-400 hover:text-primary-500 font-medium"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-muted p-1">
            <button
              onClick={() => {
                setMode('reading');
                setShowHighlights(false);
                setSelectedWord(null);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                mode === 'reading' ? 'bg-surface text-prose shadow-xs' : 'text-prose-secondary'
              }`}
            >
              Reading
            </button>
            <button
              onClick={() => {
                setMode('study');
                setShowHighlights(true);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                mode === 'study' ? 'bg-surface text-prose shadow-xs' : 'text-prose-secondary'
              }`}
            >
              Study
            </button>
          </div>
          <button
            onClick={() => setShowHighlights((prev) => !prev)}
            className="btn btn-secondary text-sm px-3 py-2"
            disabled={!isStudyMode}
          >
            {showHighlights ? 'Hide Highlights' : 'Show Highlights'}
          </button>
          <button
            onClick={startTimer}
            className="btn btn-secondary text-sm px-3 py-2"
          >
            {session.isTimerRunning ? '⏸' : '⏱'} Timer
          </button>
          {session.isTimerRunning && (
            <div className="text-lg font-mono font-semibold text-primary-400">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </div>
          )}
        </div>
      </div>

      {session.isTimerRunning && timeElapsed > 30 && (
        <div className="text-right">
          <span className={`text-xs font-medium ${getPace(paceRatio).color}`}>
            Pace: {getPace(paceRatio).label}
          </span>
        </div>
      )}

      {/* Passage Content */}
      <div className="card">
        {/* Title and Meta */}
        <div className="mb-6">
          <span className="badge badge-primary mb-3 inline-flex">
            {passage.theme}
          </span>
          <h1 className="text-2xl font-semibold text-prose mb-2">{passage.title}</h1>
          <div className="flex flex-wrap gap-2 text-sm text-prose-secondary">
            <span className="capitalize px-3 py-1 rounded bg-muted font-medium">
              {passage.difficulty}
            </span>
            <span className="px-3 py-1 rounded bg-muted">
              ~{passage.estimatedMinutes} min reading
            </span>
          </div>
        </div>

        {showHighlights && (
          <div className="mb-4 flex items-center gap-4 text-xs text-prose-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded bg-kanji-text" />
              Known kanji
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded bg-vocab-text" />
              Known vocabulary
            </span>
          </div>
        )}

        {/* Japanese Text */}
        <div className="mb-6 rounded-lg border border-stroke-subtle bg-muted p-6">
          <div className="japanese-text text-prose leading-loose">
            {passage.text.split('\n\n').map((paragraph, idx) => (
              <p key={idx} className="mb-6">
                {renderParagraphWithHighlights(
                  paragraph,
                  showHighlights,
                  highlightSets,
                  canInteractHighlights,
                  setSelectedWord
                )}
              </p>
            ))}
          </div>
        </div>

        {/* Reading Stats */}
        <div className="border-t border-stroke-subtle pt-6 flex justify-between items-center">
          <div className="text-sm text-prose-secondary">
            <p>
              Estimated time: <strong>{passage.estimatedMinutes} minutes</strong>
            </p>
            {session.isTimerRunning && (
              <p className="mt-1">
                Your time: <strong>{minutes}m {seconds}s</strong>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={handleStartQuestions}
        className="btn btn-primary w-full"
      >
        Continue to Questions →
      </button>

      {/* Help Text */}
      <p className="text-center text-sm text-prose-secondary">
        Use Study mode to tap highlighted words and view WaniKani details.
      </p>

      <WordPopup word={selectedWord} onClose={() => setSelectedWord(null)} />
    </div>
  );
}
