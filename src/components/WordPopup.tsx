type PopupItemType = 'kanji' | 'vocab';

export type PopupWordInfo = {
  token: string;
  type: PopupItemType;
  meanings: string[];
  readings: string[];
  level?: number;
  srsStage?: number;
};

type WordPopupProps = {
  word: PopupWordInfo | null;
  onClose: () => void;
  onSaveWord?: (word: PopupWordInfo) => void;
  isSaved?: boolean;
};

function getSrsStageLabel(stage?: number): string {
  if (!stage) return 'Unspecified SRS';
  if (stage <= 4) return 'Apprentice';
  if (stage <= 6) return 'Guru';
  if (stage === 7) return 'Master';
  if (stage === 8) return 'Enlightened';
  if (stage >= 9) return 'Burned';
  return 'Unspecified SRS';
}

export function WordPopup({ word, onClose, onSaveWord, isSaved = false }: WordPopupProps) {
  if (!word) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-prose/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-stroke-subtle bg-surface p-4 shadow-lg animate-fade-up"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-2xl font-semibold text-prose font-jp">{word.token}</p>
            <p className="text-xs text-prose-secondary mt-1 capitalize">{word.type}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-prose-muted transition-colors hover:bg-muted hover:text-prose"
            aria-label="Close word details"
          >
            x
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs font-medium text-prose-secondary mb-1">Meanings</p>
            <p className="text-prose">
              {word.meanings.length > 0 ? word.meanings.join(', ') : 'No meaning available'}
            </p>
          </div>

          {word.readings.length > 0 && (
            <div>
              <p className="text-xs font-medium text-prose-secondary mb-1">Readings</p>
              <p className="text-prose font-jp">{word.readings.join(' ・ ')}</p>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-stroke-subtle pt-3">
          {typeof word.level === 'number' && (
            <span className="badge badge-primary">WK level {word.level}</span>
          )}
          <span className="badge bg-muted text-prose-secondary">{getSrsStageLabel(word.srsStage)}</span>
        </div>

        {word.type === 'vocab' && onSaveWord && (
          <div className="mt-4">
            <button
              onClick={() => onSaveWord(word)}
              disabled={isSaved}
              className={`w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                isSaved
                  ? 'bg-success-100 text-success-600 cursor-not-allowed'
                  : 'bg-primary-400 text-prose-inverse hover:bg-primary-500'
              }`}
            >
              {isSaved ? 'Saved to Vocabulary' : 'Save to Vocabulary'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}