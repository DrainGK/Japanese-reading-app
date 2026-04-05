import { useEffect, useMemo, useState } from 'react';
import { Pagination } from '../components/Pagination';
import { StorageService } from '../services/storage';
import { DictionaryWord, SavedVocabularyItem } from '../types';

const PAGE_SIZE = 12;

type VocabularyTab = 'saved' | 'unlocked' | 'dictionary';

interface UnlockedVocabularyItem {
  id: number;
  token: string;
  meanings: string[];
  readings: string[];
  level: number;
  srsStage: number;
}

function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/tab-separated-values;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function VocabularyPage() {
  const [tab, setTab] = useState<VocabularyTab>('saved');
  const [page, setPage] = useState(1);
  const [savedItems, setSavedItems] = useState<SavedVocabularyItem[]>([]);
  const [unlockedItems, setUnlockedItems] = useState<UnlockedVocabularyItem[]>([]);
  const [dictionaryItems, setDictionaryItems] = useState<DictionaryWord[]>([]);

  const reloadSavedVocabulary = () => {
    setSavedItems(StorageService.getSavedVocabulary());
  };

  const reloadDictionaryWords = () => {
    setDictionaryItems(StorageService.getDictionaryWords());
  };

  const loadUnlockedVocabulary = async () => {
    const wkData = await StorageService.getWaniKaniData();
    if (!wkData) {
      setUnlockedItems([]);
      return;
    }

    const assignmentMap = new Map(
      wkData.assignments.map((assignment) => [assignment.data.subject_id, assignment.data.srs_stage])
    );

    const unlockedList = wkData.vocabularySubjects
      .filter((subject) => {
        const srsStage = assignmentMap.get(subject.id);
        return srsStage !== undefined && srsStage > 0;
      })
      .map((subject) => ({
        id: subject.id,
        token: subject.data.characters || subject.data.slug,
        meanings: subject.data.meanings.map((item) => item.meaning),
        readings: subject.data.readings?.map((item) => item.reading) || [],
        level: subject.data.level || 0,
        srsStage: assignmentMap.get(subject.id) || 0,
      }))
      .sort((a, b) => b.level - a.level || a.token.localeCompare(b.token));

    setUnlockedItems(unlockedList);
  };

  useEffect(() => {
    reloadSavedVocabulary();
    reloadDictionaryWords();
    void loadUnlockedVocabulary();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  const totalCount =
    tab === 'saved' ? savedItems.length : tab === 'unlocked' ? unlockedItems.length : dictionaryItems.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleRemoveSaved = (token: string) => {
    StorageService.removeSavedVocabulary(token);
    reloadSavedVocabulary();
  };

  const handleRemoveDictionary = (id: string) => {
    StorageService.removeDictionaryWord(id);
    reloadDictionaryWords();
  };

  const handleExportSavedAnki = () => {
    const tsv = StorageService.exportSavedVocabularyAsAnkiTsv();
    const today = new Date().toISOString().split('T')[0];
    downloadTextFile(`n2-reader-vocab-${today}.tsv`, tsv);
  };

  const handleExportDictionaryAnki = () => {
    const tsv = StorageService.exportDictionaryWordsAsAnkiTsv();
    const today = new Date().toISOString().split('T')[0];
    downloadTextFile(`n2-reader-dictionary-${today}.tsv`, tsv);
  };

  const savedLevelsCount = useMemo(() => {
    return new Set(
      savedItems
        .map((item) => item.level)
        .filter((level): level is number => typeof level === 'number')
    ).size;
  }, [savedItems]);

  const unlockedLevelsCount = useMemo(() => {
    return new Set(unlockedItems.map((item) => item.level)).size;
  }, [unlockedItems]);

  const dictionaryLevelsCount = useMemo(() => {
    return new Set(dictionaryItems.map((item) => item.jlpt).filter(Boolean)).size;
  }, [dictionaryItems]);

  const savedRows = savedItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const unlockedRows = unlockedItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const dictionaryRows = dictionaryItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex gap-3 overflow-x-auto border-b border-stroke-subtle pb-1">
            <button
              onClick={() => setTab('saved')}
              className={`shrink-0 pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
                tab === 'saved'
                  ? 'border-primary-400 text-prose'
                  : 'border-transparent text-prose-secondary hover:text-prose'
              }`}
            >
              WaniKani Vocab
            </button>
            <button
              onClick={() => setTab('unlocked')}
              className={`shrink-0 pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
                tab === 'unlocked'
                  ? 'border-primary-400 text-prose'
                  : 'border-transparent text-prose-secondary hover:text-prose'
              }`}
            >
              Unlocked WaniKani Vocab
            </button>
            <button
              onClick={() => setTab('dictionary')}
              className={`shrink-0 pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
                tab === 'dictionary'
                  ? 'border-primary-400 text-prose'
                  : 'border-transparent text-prose-secondary hover:text-prose'
              }`}
            >
              Dictionary {dictionaryItems.length > 0 ? `(${dictionaryItems.length})` : ''}
            </button>
          </div>

          {tab === 'saved' && (
            <p className="mt-2 text-sm text-prose-secondary">
              WaniKani vocabulary saved from reading mode, ready for review or Anki export.
            </p>
          )}
          {tab === 'unlocked' && (
            <p className="mt-2 text-sm text-prose-secondary">
              Vocabulary unlocked in WaniKani. Sorted by level (highest first).
            </p>
          )}
          {tab === 'dictionary' && (
            <p className="mt-2 text-sm text-prose-secondary">
              Words looked up from the in-reader dictionary and saved for later review.
            </p>
          )}
        </div>

        {tab === 'saved' && (
          <button
            onClick={handleExportSavedAnki}
            disabled={savedItems.length === 0}
            className="btn btn-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export Anki TSV
          </button>
        )}

        {tab === 'dictionary' && (
          <button
            onClick={handleExportDictionaryAnki}
            disabled={dictionaryItems.length === 0}
            className="btn btn-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export Dictionary TSV
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {tab === 'saved' && (
          <>
            <div className="card text-center">
              <p className="text-2xl font-semibold text-primary-400">{savedItems.length}</p>
              <p className="mt-1 text-xs text-prose-secondary">Saved Words</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-semibold text-success-500">{savedLevelsCount}</p>
              <p className="mt-1 text-xs text-prose-secondary">WK Levels</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-semibold text-warning-500">
                {savedItems.filter((item) => item.srsStage && item.srsStage >= 5).length}
              </p>
              <p className="mt-1 text-xs text-prose-secondary">Guru+ Items</p>
            </div>
          </>
        )}

        {tab === 'unlocked' && (
          <>
            <div className="card text-center">
              <p className="text-2xl font-semibold text-primary-400">{unlockedItems.length}</p>
              <p className="mt-1 text-xs text-prose-secondary">Unlocked Words</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-semibold text-success-500">{unlockedLevelsCount}</p>
              <p className="mt-1 text-xs text-prose-secondary">WK Levels</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-semibold text-warning-500">
                {unlockedItems.filter((item) => item.srsStage >= 5).length}
              </p>
              <p className="mt-1 text-xs text-prose-secondary">Guru+ Items</p>
            </div>
          </>
        )}

        {tab === 'dictionary' && (
          <>
            <div className="card text-center">
              <p className="text-2xl font-semibold text-primary-400">{dictionaryItems.length}</p>
              <p className="mt-1 text-xs text-prose-secondary">Saved Lookups</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-semibold text-success-500">{dictionaryLevelsCount}</p>
              <p className="mt-1 text-xs text-prose-secondary">JLPT Bands</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-semibold text-warning-500">
                {dictionaryItems.filter((item) => item.isCommon).length}
              </p>
              <p className="mt-1 text-xs text-prose-secondary">Common Words</p>
            </div>
          </>
        )}
      </div>

      {tab === 'saved' && (
        <>
          {savedItems.length === 0 ? (
            <div className="card text-sm text-prose-secondary">
              No saved vocabulary yet. Open a reading passage, switch to Study mode, and save highlighted vocabulary from the popup.
            </div>
          ) : (
            <div className="card overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-stroke-subtle bg-muted text-left text-prose-secondary">
                    <th className="px-3 py-2">Word</th>
                    <th className="px-3 py-2">Meaning</th>
                    <th className="px-3 py-2">Reading</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">WK</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {savedRows.map((row) => (
                    <tr key={row.id} className="border-b border-stroke-subtle last:border-b-0">
                      <td className="px-3 py-2 text-base font-jp text-prose">{row.token}</td>
                      <td className="px-3 py-2 text-prose">{row.meaning}</td>
                      <td className="px-3 py-2 text-prose-secondary">{row.readings.join(' / ') || '-'}</td>
                      <td className="px-3 py-2 text-prose-secondary uppercase">
                        {row.source === 'jisho' ? 'JISHO' : 'WK'}
                      </td>
                      <td className="px-3 py-2 text-prose-secondary">
                        L{row.level ?? '-'} · SRS {row.srsStage ?? '-'}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => handleRemoveSaved(row.token)}
                          className="rounded-md bg-danger-50 px-2.5 py-1 text-xs text-danger-600 hover:bg-danger-100"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </>
      )}

      {tab === 'unlocked' && (
        <>
          {unlockedItems.length === 0 ? (
            <div className="card text-sm text-prose-secondary">
              No unlocked vocabulary found. Connect your WaniKani account and unlock vocabulary items to see them here.
            </div>
          ) : (
            <div className="card overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-stroke-subtle bg-muted text-left text-prose-secondary">
                    <th className="px-3 py-2">Word</th>
                    <th className="px-3 py-2">Meaning</th>
                    <th className="px-3 py-2">Reading</th>
                    <th className="px-3 py-2">WK</th>
                  </tr>
                </thead>
                <tbody>
                  {unlockedRows.map((row) => (
                    <tr key={row.id} className="border-b border-stroke-subtle last:border-b-0">
                      <td className="px-3 py-2 text-base font-jp text-prose">{row.token}</td>
                      <td className="px-3 py-2 text-prose">{row.meanings.join(', ')}</td>
                      <td className="px-3 py-2 text-prose-secondary">{row.readings.join(' / ') || '-'}</td>
                      <td className="px-3 py-2 text-prose-secondary">L{row.level} · SRS {row.srsStage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </>
      )}

      {tab === 'dictionary' && (
        <>
          {dictionaryItems.length === 0 ? (
            <div className="card text-sm text-prose-secondary">
              No dictionary words saved yet. In Study mode, tap any Japanese word to look it up and save it.
            </div>
          ) : (
            <div className="space-y-3">
              {dictionaryRows.map((word) => (
                <div key={word.id} className="card flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-jp text-xl font-medium text-prose">{word.word}</span>
                      {word.reading !== word.word && (
                        <span className="font-jp text-sm text-prose-secondary">{word.reading}</span>
                      )}
                    </div>

                    <p className="mt-1 text-sm text-prose">{word.meanings.slice(0, 2).join(', ')}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {word.jlpt && <span className="badge badge-primary">{word.jlpt}</span>}
                      {word.isCommon && <span className="badge badge-success">Common</span>}
                      <span className="truncate text-xs text-prose-muted">· {word.sourceTextTitle}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveDictionary(word.id)}
                    className="shrink-0 rounded-lg p-1 text-prose-muted transition-colors hover:bg-danger-50 hover:text-danger-500"
                    aria-label="Remove dictionary word"
                  >
                    x
                  </button>
                </div>
              ))}

              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
