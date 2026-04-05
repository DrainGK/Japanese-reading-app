import { useEffect, useState } from 'react';
import { StorageService } from '../services/storage';
import { DictionaryWord } from '../types';
import { getBestMatch, getJLPT, JishoResult, searchJisho } from '../utils/jisho';

type LoadState = 'loading' | 'loaded' | 'error' | 'empty' | 'offline';

type DictPopupProps = {
  word: string;
  textId: string;
  textTitle: string;
  onClose: () => void;
};

export function DictPopup({ word, textId, textTitle, onClose }: DictPopupProps) {
  const [state, setState] = useState<LoadState>('loading');
  const [results, setResults] = useState<JishoResult[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setResults([]);
    setActiveIdx(0);
    setSaved(false);

    if (!navigator.onLine) {
      setState('offline');
      return () => {
        cancelled = true;
      };
    }

    searchJisho(word)
      .then((data) => {
        if (cancelled) return;
        if (data.length === 0) {
          setState('empty');
          return;
        }
        setResults(data);
        setSaved(StorageService.isDictionaryWordSaved(data[0].slug));
        setState('loaded');
      })
      .catch(() => {
        if (!cancelled) {
          setState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [word]);

  const active = results[activeIdx];

  const handleSave = () => {
    if (!active) return;

    const { word: matchedWord, reading } = getBestMatch(active);
    const payload: DictionaryWord = {
      id: active.slug,
      word: matchedWord,
      reading,
      meanings: active.senses[0]?.english_definitions ?? [],
      partsOfSpeech: active.senses[0]?.parts_of_speech ?? [],
      jlpt: getJLPT(active),
      isCommon: active.is_common,
      savedAt: Date.now(),
      sourceTextId: textId,
      sourceTextTitle: textTitle,
    };

    StorageService.saveDictionaryWord(payload);
    setSaved(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-prose/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-stroke-subtle bg-surface p-4 shadow-lg animate-fade-up"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-prose-secondary">Dictionary</p>
            <p className="text-lg font-semibold text-prose font-jp">{word}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-prose-muted transition-colors hover:bg-muted hover:text-prose"
            aria-label="Close dictionary popup"
          >
            x
          </button>
        </div>

        {state === 'loading' && <p className="py-6 text-sm text-prose-secondary">Looking up Jisho...</p>}

        {state === 'offline' && (
          <p className="py-6 text-sm text-warning-600">Recherche indisponible hors ligne.</p>
        )}

        {state === 'error' && (
          <p className="py-6 text-sm text-danger-600">Impossible de contacter Jisho.</p>
        )}

        {state === 'empty' && (
          <p className="py-6 text-sm text-prose-secondary">No result found for this selection.</p>
        )}

        {state === 'loaded' && active && (
          <div className="space-y-3">
            <div>
              <p className="text-2xl font-semibold text-prose font-jp">{getBestMatch(active).word}</p>
              <p className="text-sm text-prose-secondary font-jp">{getBestMatch(active).reading}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {getJLPT(active) && <span className="badge badge-primary">{getJLPT(active)}</span>}
              {active.is_common && <span className="badge badge-success">Common</span>}
            </div>

            <div className="space-y-2 text-sm">
              {active.senses.slice(0, 3).map((sense, idx) => (
                <p key={`${active.slug}-${idx}`} className="text-prose">
                  {idx + 1}. {sense.english_definitions.slice(0, 3).join(', ')}
                </p>
              ))}
            </div>

            {results.length > 1 && (
              <div className="flex flex-wrap gap-2 border-t border-stroke-subtle pt-3">
                {results.map((result, idx) => (
                  <button
                    key={`${result.slug}-${idx}`}
                    onClick={() => {
                      setActiveIdx(idx);
                      setSaved(StorageService.isDictionaryWordSaved(result.slug));
                    }}
                    className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                      activeIdx === idx
                        ? 'bg-primary-100 text-primary-600'
                        : 'bg-muted text-prose-secondary hover:text-prose'
                    }`}
                  >
                    {getBestMatch(result).word}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saved}
              className={`w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                saved
                  ? 'bg-success-100 text-success-600 cursor-not-allowed'
                  : 'bg-primary-400 text-prose-inverse hover:bg-primary-500'
              }`}
            >
              {saved ? 'Saved to Dictionary' : 'Save to Dictionary'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
