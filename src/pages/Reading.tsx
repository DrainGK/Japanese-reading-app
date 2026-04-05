import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DictPopup } from '../components/DictPopup';
import { PopupWordInfo, WordPopup } from '../components/WordPopup';
import { passages } from '../data/passages';
import { useSession } from '../hooks/useSession';
import { getMatchingVocabularyTokens } from '../lib/passageMatching';
import { StorageService } from '../services/storage';
import { WaniKaniData, WaniKaniSubject } from '../types';
import { extractWordAt, splitIntoSegments } from '../utils/segmentation';
import { getTokenizer, hasJapanese, isHiragana, mergeTokens, tokenize, Token } from '../utils/tokenizer';

type HighlightSets = {
  kanji: Set<string>;
  vocab: Set<string>;
  kanjiInfo: Map<string, PopupWordInfo>;
  vocabInfo: Map<string, PopupWordInfo>;
};

type ReadingMode = 'reading' | 'study';
type TokenKind = 'wk-kanji' | 'wk-vocab' | 'unknown-jp' | 'plain';

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

function createEmptyHighlightSets(): HighlightSets {
  return {
    kanji: new Set(),
    vocab: new Set(),
    kanjiInfo: new Map(),
    vocabInfo: new Map(),
  };
}

function buildHighlightSets(data: WaniKaniData | null): HighlightSets {
  if (!data) {
    return createEmptyHighlightSets();
  }

  const wkKanji = new Set<string>();
  const wkVocab = new Set<string>();
  const kanjiInfo = new Map<string, PopupWordInfo>();
  const vocabInfo = new Map<string, PopupWordInfo>();

  data.assignments.forEach((assignment) => {
    if (assignment.data.srs_stage <= 0) {
      return;
    }

    const subject = data.subjects.get(assignment.data.subject_id);
    if (!subject) {
      return;
    }

    if (subject.type === 'kanji' && subject.data.characters) {
      wkKanji.add(subject.data.characters);
      kanjiInfo.set(subject.data.characters, toPopupInfo(subject, assignment.data.srs_stage));
      return;
    }

    if (subject.type === 'vocabulary' || subject.type === 'kana_vocabulary') {
      const token = subject.data.characters ?? subject.data.slug;
      if (!token) {
        return;
      }

      wkVocab.add(token);
      vocabInfo.set(token, toPopupInfo(subject, assignment.data.srs_stage));
    }
  });

  return {
    kanji: wkKanji,
    vocab: wkVocab,
    kanjiInfo,
    vocabInfo,
  };
}

function normalizeDictionaryForm(token: Token): string {
  const basic = token.basic_form?.trim();
  if (!basic || basic === '*') {
    return token.surface_form;
  }

  return basic;
}

function classifyToken(token: Token, wkKanji: Set<string>, wkVocab: Set<string>): TokenKind {
  const surface = token.surface_form;
  const basic = normalizeDictionaryForm(token);

  if (wkVocab.has(surface) || wkVocab.has(basic)) {
    return 'wk-vocab';
  }

  const isComposite = surface.length > 1 && [...surface].some((ch) => isHiragana(ch));

  if (!isComposite && [...surface].some((ch) => wkKanji.has(ch))) {
    return 'wk-kanji';
  }

  if (hasJapanese(token)) {
    return 'unknown-jp';
  }

  return 'plain';
}

function getPopupWordForToken(token: Token, sets: HighlightSets): PopupWordInfo | null {
  const surface = token.surface_form;
  const basic = normalizeDictionaryForm(token);

  const vocabWord = sets.vocabInfo.get(surface) ?? sets.vocabInfo.get(basic);
  if (vocabWord) {
    return vocabWord;
  }

  const isComposite = surface.length > 1 && [...surface].some((ch) => isHiragana(ch));
  if (!isComposite) {
    for (const char of surface) {
      const kanjiWord = sets.kanjiInfo.get(char);
      if (kanjiWord) {
        return kanjiWord;
      }
    }
  }

  return null;
}

function splitTokensIntoParagraphs(tokens: Token[]): Token[][] {
  const paragraphs: Token[][] = [[]];

  tokens.forEach((token) => {
    const parts = token.surface_form.split(/(\n{2,})/);

    parts.forEach((part) => {
      if (!part) {
        return;
      }

      if (/^\n{2,}$/.test(part)) {
        if (paragraphs[paragraphs.length - 1].length > 0) {
          paragraphs.push([]);
        }
        return;
      }

      const lineParts = part.split(/(\n)/);
      lineParts.forEach((linePart) => {
        if (!linePart) {
          return;
        }

        paragraphs[paragraphs.length - 1].push({
          ...token,
          surface_form: linePart,
        });
      });
    });
  });

  return paragraphs.filter((paragraph) => paragraph.length > 0);
}

function renderFallbackParagraph(
  paragraph: string,
  showHighlights: boolean,
  sets: HighlightSets,
  interactive: boolean,
  studyMode: boolean,
  onSelectWord: (word: PopupWordInfo) => void,
  onDictionaryLookup: (word: string) => void
): JSX.Element[] {
  if (!showHighlights) {
    return splitIntoSegments(paragraph).map((segment, index) => {
      if (studyMode && segment.isJapanese) {
        const lookupWord = extractWordAt(segment.text, 0) || segment.text;
        return (
          <span
            key={`plain-${index}`}
            className="highlight-unknown"
            onClick={() => onDictionaryLookup(lookupWord)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onDictionaryLookup(lookupWord);
              }
            }}
          >
            {segment.text}
          </span>
        );
      }

      return <span key={`plain-${index}`}>{segment.text}</span>;
    });
  }

  const nodes: JSX.Element[] = [];
  const vocabTokens = Array.from(getMatchingVocabularyTokens(paragraph, sets.vocab)).sort(
    (a, b) => b.length - a.length
  );

  let index = 0;
  let keyIndex = 0;
  let plainBuffer = '';

  const flushPlainBuffer = () => {
    if (!plainBuffer) {
      return;
    }

    splitIntoSegments(plainBuffer).forEach((segment) => {
      const key = `plain-${keyIndex++}`;

      if (studyMode && segment.isJapanese) {
        const lookupWord = extractWordAt(segment.text, 0) || segment.text;
        nodes.push(
          <span
            key={key}
            className="highlight-unknown"
            onClick={() => onDictionaryLookup(lookupWord)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onDictionaryLookup(lookupWord);
              }
            }}
          >
            {segment.text}
          </span>
        );
        return;
      }

      nodes.push(<span key={key}>{segment.text}</span>);
    });

    plainBuffer = '';
  };

  while (index < paragraph.length) {
    const vocabMatch = vocabTokens.find((token) => paragraph.startsWith(token, index));
    if (vocabMatch) {
      flushPlainBuffer();
      const vocabWord = sets.vocabInfo.get(vocabMatch);
      nodes.push(
        <span
          key={`vocab-${keyIndex++}`}
          className={showHighlights ? 'highlight-vocab' : undefined}
          onClick={() => interactive && vocabWord && onSelectWord(vocabWord)}
          role={interactive ? 'button' : undefined}
          tabIndex={interactive ? 0 : undefined}
          onKeyDown={(event) => {
            if (!interactive || !vocabWord) {
              return;
            }

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
      flushPlainBuffer();
      const kanjiWord = sets.kanjiInfo.get(char);
      nodes.push(
        <span
          key={`kanji-${keyIndex++}`}
          className={showHighlights ? 'highlight-kanji' : undefined}
          onClick={() => interactive && kanjiWord && onSelectWord(kanjiWord)}
          role={interactive ? 'button' : undefined}
          tabIndex={interactive ? 0 : undefined}
          onKeyDown={(event) => {
            if (!interactive || !kanjiWord) {
              return;
            }

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
      plainBuffer += char;
    }

    index += 1;
  }

  flushPlainBuffer();
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
  const [dictWord, setDictWord] = useState<string | null>(null);
  const [savedVocabularyTokens, setSavedVocabularyTokens] = useState<Set<string>>(new Set());
  const [tokens, setTokens] = useState<Token[]>([]);
  const [tokenizerReady, setTokenizerReady] = useState(false);
  const [highlightSets, setHighlightSets] = useState<HighlightSets>(createEmptyHighlightSets());

  const passage = passages.find((p) => p.id === id);

  useEffect(() => {
    let active = true;

    const loadHighlights = async () => {
      if (!passage) {
        return;
      }

      const wkData = await StorageService.getWaniKaniData();
      if (!active) {
        return;
      }

      setHighlightSets(buildHighlightSets(wkData));
      const saved = StorageService.getSavedVocabulary();
      setSavedVocabularyTokens(new Set(saved.map((item) => item.token)));
    };

    void loadHighlights();

    return () => {
      active = false;
    };
  }, [passage]);

  useEffect(() => {
    let active = true;

    if (!passage) {
      return () => {
        active = false;
      };
    }

    setTokenizerReady(false);
    setTokens([]);

    getTokenizer()
      .then((tokenizer) => {
        if (!active) {
          return;
        }

        const merged = mergeTokens(tokenize(passage.text, tokenizer));
        setTokens(merged);
        setTokenizerReady(true);
      })
      .catch((error) => {
        console.warn('kuromoji failed to load:', error);
        if (!active) {
          return;
        }

        setTokenizerReady(false);
        setTokens([]);
      });

    return () => {
      active = false;
    };
  }, [passage?.id]);

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

  const handleSaveWord = (word: PopupWordInfo) => {
    StorageService.saveVocabularyItem({
      token: word.token,
      meaning: word.meanings[0] ?? 'No meaning available',
      readings: word.readings,
      level: word.level,
      srsStage: word.srsStage,
      source: 'reading',
    });

    setSavedVocabularyTokens((prev) => new Set(prev).add(word.token));
  };

  const handleWaniKaniTap = (word: PopupWordInfo) => {
    setDictWord(null);
    setSelectedWord((current) => (current?.token === word.token ? null : word));
  };

  const handleDictionaryTap = (token: Token) => {
    const lookupWord = normalizeDictionaryForm(token);
    if (!lookupWord) {
      return;
    }

    setSelectedWord(null);
    setDictWord(lookupWord);
  };

  const handleDictionaryWordTap = (lookupWord: string) => {
    if (!lookupWord) {
      return;
    }

    setSelectedWord(null);
    setDictWord(lookupWord);
  };

  const minutes = Math.floor(timeElapsed / 60);
  const seconds = timeElapsed % 60;
  const estimatedSeconds = passage.estimatedMinutes * 60;
  const paceRatio = estimatedSeconds > 0 ? timeElapsed / estimatedSeconds : 0;

  const isStudyMode = mode === 'study';
  const canInteractHighlights = isStudyMode;
  const tokenParagraphs = tokenizerReady ? splitTokensIntoParagraphs(tokens) : [];

  const getPace = (ratio: number): { label: string; color: string } => {
    if (ratio < 0.8) return { label: 'Ahead of pace', color: 'text-success-500' };
    if (ratio < 1.2) return { label: 'On pace', color: 'text-prose-muted' };
    return { label: 'Take your time', color: 'text-warning-500' };
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="text-primary-400 hover:text-primary-500 font-medium"
          >
            竊・Back
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={startTimer}
              className="btn btn-secondary text-sm px-3 py-2"
            >
              {session.isTimerRunning ? '竢ｸ' : '竢ｱ'} Timer
            </button>
            {session.isTimerRunning && (
              <div className="text-lg font-mono font-semibold text-primary-400">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg bg-muted p-1">
            <button
              onClick={() => {
                setMode('reading');
                setShowHighlights(false);
                setSelectedWord(null);
                setDictWord(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
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
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
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
        </div>
      </div>

      {session.isTimerRunning && timeElapsed > 30 && (
        <div className="text-right">
          <span className={`text-xs font-medium ${getPace(paceRatio).color}`}>
            Pace: {getPace(paceRatio).label}
          </span>
        </div>
      )}

      {isStudyMode && tokenizerReady && (
        <p className="text-center text-xs text-prose-muted">
          Tap any Japanese word to look it up · <span className="text-violet-500">violet = unknown</span>
        </p>
      )}

      <div className="card">
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

        <div className="mb-6 rounded-lg border border-stroke-subtle bg-muted p-6">
          <div className="japanese-text text-prose leading-loose">
            {tokenizerReady
              ? tokenParagraphs.map((paragraphTokens, paragraphIndex) => (
                  <p key={paragraphIndex} className="mb-6">
                    {paragraphTokens.map((token, tokenIndex) => {
                      if (token.surface_form === '\n') {
                        return <br key={`br-${paragraphIndex}-${tokenIndex}`} />;
                      }

                      const type = classifyToken(token, highlightSets.kanji, highlightSets.vocab);
                      const popupWord = getPopupWordForToken(token, highlightSets);
                      const baseInteractiveProps = {
                        role: 'button' as const,
                        tabIndex: 0,
                        onKeyDown: (event: React.KeyboardEvent<HTMLSpanElement>) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();

                            if (type === 'unknown-jp') {
                              handleDictionaryTap(token);
                              return;
                            }

                            if (popupWord) {
                              handleWaniKaniTap(popupWord);
                            }
                          }
                        },
                      };

                      if (type === 'wk-vocab' && popupWord) {
                        return (
                          <span
                            key={`${paragraphIndex}-${tokenIndex}`}
                            className={
                              showHighlights
                                ? 'highlight-vocab'
                                : canInteractHighlights
                                  ? 'cursor-pointer rounded-sm px-0.5'
                                  : undefined
                            }
                            onClick={() => canInteractHighlights && handleWaniKaniTap(popupWord)}
                            {...(canInteractHighlights ? baseInteractiveProps : {})}
                          >
                            {token.surface_form}
                          </span>
                        );
                      }

                      if (type === 'wk-kanji' && popupWord) {
                        return (
                          <span
                            key={`${paragraphIndex}-${tokenIndex}`}
                            className={
                              showHighlights
                                ? 'highlight-kanji'
                                : canInteractHighlights
                                  ? 'cursor-pointer rounded-sm px-0.5'
                                  : undefined
                            }
                            onClick={() => canInteractHighlights && handleWaniKaniTap(popupWord)}
                            {...(canInteractHighlights ? baseInteractiveProps : {})}
                          >
                            {token.surface_form}
                          </span>
                        );
                      }

                      if (type === 'unknown-jp' && isStudyMode) {
                        return (
                          <span
                            key={`${paragraphIndex}-${tokenIndex}`}
                            className="highlight-unknown"
                            onClick={() => handleDictionaryTap(token)}
                            {...baseInteractiveProps}
                          >
                            {token.surface_form}
                          </span>
                        );
                      }

                      return <span key={`${paragraphIndex}-${tokenIndex}`}>{token.surface_form}</span>;
                    })}
                  </p>
                ))
              : passage.text.split('\n\n').map((paragraph, idx) => (
                  <p key={idx} className="mb-6">
                    {renderFallbackParagraph(
                      paragraph,
                      showHighlights,
                      highlightSets,
                      canInteractHighlights,
                      isStudyMode,
                      handleWaniKaniTap,
                      handleDictionaryWordTap
                    )}
                  </p>
                ))}
          </div>
        </div>

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

      <button
        onClick={handleStartQuestions}
        className="btn btn-primary w-full"
      >
        Continue to Questions 竊・
      </button>

      <p className="text-center text-sm text-prose-secondary">
        Study mode uses WaniKani highlights plus tap-to-look-up tokens.
      </p>

      <WordPopup
        word={selectedWord}
        onClose={() => setSelectedWord(null)}
        onSaveWord={handleSaveWord}
        isSaved={selectedWord ? savedVocabularyTokens.has(selectedWord.token) : false}
      />

      {dictWord && (
        <DictPopup
          word={dictWord}
          textId={passage.id}
          textTitle={passage.title}
          onClose={() => setDictWord(null)}
        />
      )}
    </div>
  );
}
