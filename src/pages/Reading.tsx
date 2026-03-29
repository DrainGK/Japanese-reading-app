import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { passages } from '../data/passages';
import { useSession } from '../hooks/useSession';
import { StorageService } from '../services/storage';
import { ReadingPassage, WaniKaniData } from '../types';
import { getMatchingVocabularyTokens } from '../lib/passageMatching';

type HighlightSets = {
  kanji: Set<string>;
  vocab: Set<string>;
};

const BLUE_HIGHLIGHT = 'text-blue-700 bg-blue-100 rounded px-0.5';
const GREEN_HIGHLIGHT = 'text-green-700 bg-green-100 rounded px-0.5';

function buildHighlightSets(passage: ReadingPassage, data: WaniKaniData | null): HighlightSets {
  if (!data) {
    return { kanji: new Set(), vocab: new Set() };
  }

  const wkKanji = new Set<string>();
  const wkVocab = new Set<string>();

  data.assignments.forEach((assignment) => {
    const subject = data.subjects.get(assignment.data.subject_id);
    if (!subject) return;

    if (subject.type === 'kanji' && subject.data.characters) {
      wkKanji.add(subject.data.characters);
      return;
    }

    if ((subject.type === 'vocabulary' || subject.type === 'kana_vocabulary')) {
      const token = subject.data.characters ?? subject.data.slug;
      if (token) {
        wkVocab.add(token);
      }
    }
  });

  return {
    kanji: new Set(passage.kanjiList.filter((kanji) => wkKanji.has(kanji))),
    vocab: getMatchingVocabularyTokens(passage.text, wkVocab),
  };
}

function renderParagraphWithHighlights(
  paragraph: string,
  showHighlights: boolean,
  sets: HighlightSets
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
      nodes.push(
        <span key={`vocab-${keyIndex++}`} className={GREEN_HIGHLIGHT}>
          {vocabMatch}
        </span>
      );
      index += vocabMatch.length;
      continue;
    }

    const char = paragraph[index];
    if (sets.kanji.has(char)) {
      nodes.push(
        <span key={`kanji-${keyIndex++}`} className={BLUE_HIGHLIGHT}>
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
  const [showHighlights, setShowHighlights] = useState(true);
  const [highlightSets, setHighlightSets] = useState<HighlightSets>({
    kanji: new Set(),
    vocab: new Set(),
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

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4">
      {/* Header with Timer */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={handleBack}
          className="text-indigo-600 hover:text-indigo-700 font-medium"
        >
          ← Back
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowHighlights((prev) => !prev)}
            className="btn btn-secondary text-sm"
          >
            {showHighlights ? 'Hide Highlights' : 'Show Highlights'}
          </button>
          <button
            onClick={startTimer}
            className="btn btn-secondary text-sm"
          >
            {session.isTimerRunning ? '⏸' : '⏱'} Timer
          </button>
          {session.isTimerRunning && (
            <div className="text-lg font-mono font-semibold text-indigo-600">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </div>
          )}
        </div>
      </div>

      {/* Passage Content */}
      <div className="card mb-8">
        {/* Title and Meta */}
        <div className="mb-8">
          <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-700 mb-3">
            {passage.theme}
          </span>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{passage.title}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span className="capitalize px-3 py-1 rounded bg-gray-100 font-medium">
              {passage.difficulty}
            </span>
            <span className="px-3 py-1 rounded bg-gray-100">
              ~{passage.estimatedMinutes} min reading
            </span>
          </div>
        </div>

        {/* Japanese Text */}
        <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
          <div className="japanese-text text-gray-800 leading-loose">
            {passage.text.split('\n\n').map((paragraph, idx) => (
              <p key={idx} className="mb-6">
                {renderParagraphWithHighlights(
                  paragraph,
                  showHighlights,
                  highlightSets
                )}
              </p>
            ))}
          </div>
        </div>

        {/* Reading Stats */}
        <div className="border-t pt-6 flex justify-between items-center">
          <div className="text-sm text-gray-600">
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
        className="btn btn-primary w-full mb-4"
      >
        Continue to Questions →
      </button>

      {/* Help Text */}
      <p className="text-center text-sm text-gray-600">
        Read the passage carefully. You can use the timer to track your reading time.
      </p>
    </div>
  );
}
