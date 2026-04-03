import { useEffect, useMemo, useState } from 'react';
import { StorageService } from '../services/storage';
import { Pagination } from '../components/Pagination';
import { SavedVocabularyItem } from '../types';

const PAGE_SIZE = 12;

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
  const [savedItems, setSavedItems] = useState<SavedVocabularyItem[]>([]);
  const [unlockedItems, setUnlockedItems] = useState<UnlockedVocabularyItem[]>([]);
  const [tab, setTab] = useState<'saved' | 'unlocked'>('saved');
  const [page, setPage] = useState(1);

  const reloadSavedVocabulary = () => {
    setSavedItems(StorageService.getSavedVocabulary());
  };

  const loadUnlockedVocabulary = async () => {
    const wkData = await StorageService.getWaniKaniData();
    if (!wkData) {
      setUnlockedItems([]);
      return;
    }

    const assignmentMap = new Map(wkData.assignments.map((a) => [a.data.subject_id, a.data.srs_stage]));
    const unlockedList = wkData.vocabularySubjects
      .filter((subject) => {
        const srsStage = assignmentMap.get(subject.id);
        return srsStage !== undefined && srsStage > 0;
      })
      .map((subject) => ({
        id: subject.id,
        token: subject.data.characters || subject.data.slug,
        meanings: subject.data.meanings.map((m) => m.meaning),
        readings: subject.data.readings?.map((r) => r.reading) || [],
        level: subject.data.level || 0,
        srsStage: assignmentMap.get(subject.id) || 0,
      }))
      .sort((a, b) => b.level - a.level || a.token.localeCompare(b.token));

    setUnlockedItems(unlockedList);
  };

  useEffect(() => {
    reloadSavedVocabulary();
    loadUnlockedVocabulary();
  }, []);

  const levelsCount = useMemo(() => {
    return new Set(savedItems.map((item) => item.level).filter((level): level is number => typeof level === 'number')).size;
  }, [savedItems]);

  const displayItems = tab === 'saved' ? savedItems : unlockedItems;
  const totalPages = Math.max(1, Math.ceil(displayItems.length / PAGE_SIZE));
  const pageRows = displayItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when switching tabs
  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleRemove = (token: string) => {
    StorageService.removeSavedVocabulary(token);
    reloadSavedVocabulary();
  };

  const handleExportAnki = () => {
    const tsv = StorageService.exportSavedVocabularyAsAnkiTsv();
    const today = new Date().toISOString().split('T')[0];
    downloadTextFile(`n2-reader-vocab-${today}.tsv`, tsv);
  };

  return (
    <div className="space-y-6">
      {/* Tab Headers */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex gap-2 border-b border-stroke-subtle">
            <button
              onClick={() => setTab('saved')}
              className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
                tab === 'saved'
                  ? 'border-primary-400 text-prose'
                  : 'border-transparent text-prose-secondary hover:text-prose'
              }`}
            >
              Saved Vocabulary
            </button>
            <button
              onClick={() => setTab('unlocked')}
              className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
                tab === 'unlocked'
                  ? 'border-primary-400 text-prose'
                  : 'border-transparent text-prose-secondary hover:text-prose'
              }`}
            >
              Unlocked Vocabulary
            </button>
          </div>
          {tab === 'saved' && (
            <p className="text-sm text-prose-secondary mt-2">
              Words saved from reading mode, ready for review or Anki export.
            </p>
          )}
          {tab === 'unlocked' && (
            <p className="text-sm text-prose-secondary mt-2">
              Vocabulary unlocked in WaniKani. Sorted by level (highest first).
            </p>
          )}
        </div>

        {tab === 'saved' && (
          <button
            onClick={handleExportAnki}
            disabled={savedItems.length === 0}
            className="btn btn-secondary px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export Anki TSV
          </button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        {tab === 'saved' ? (
          <>
            <div className="card text-center">
              <p className="text-2xl font-semibold text-primary-400">{savedItems.length}</p>
              <p className="text-xs text-prose-secondary mt-1">Saved Words</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-semibold text-success-500">{levelsCount}</p>
              <p className="text-xs text-prose-secondary mt-1">WK Levels</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-semibold text-warning-500">
                {savedItems.filter((item) => item.srsStage && item.srsStage >= 5).length}
              </p>
              <p className="text-xs text-prose-secondary mt-1">Guru+ Items</p>
            </div>
          </>
        ) : (
          <>
            <div className="card text-center">
              <p className="text-2xl font-semibold text-primary-400">{unlockedItems.length}</p>
              <p className="text-xs text-prose-secondary mt-1">Unlocked Words</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-semibold text-success-500">
                {new Set(unlockedItems.map((item) => item.level)).size}
              </p>
              <p className="text-xs text-prose-secondary mt-1">WK Levels</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-semibold text-warning-500">
                {unlockedItems.filter((item) => item.srsStage >= 5).length}
              </p>
              <p className="text-xs text-prose-secondary mt-1">Guru+ Items</p>
            </div>
          </>
        )}
      </div>

      {displayItems.length === 0 ? (
        <div className="card text-sm text-prose-secondary">
          {tab === 'saved'
            ? 'No saved vocabulary yet. Open a reading passage, switch to Study mode, and save highlighted vocabulary from the popup.'
            : 'No unlocked vocabulary found. Connect your WaniKani account and unlock vocabulary items to see them here.'}
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
                {tab === 'saved' && <th className="px-3 py-2">Action</th>}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={tab === 'saved' ? row.id : (row as UnlockedVocabularyItem).id} className="border-b border-stroke-subtle last:border-b-0">
                  <td className="px-3 py-2 text-base font-jp text-prose">
                    {tab === 'saved' ? (row as SavedVocabularyItem).token : (row as UnlockedVocabularyItem).token}
                  </td>
                  <td className="px-3 py-2 text-prose">
                    {tab === 'saved'
                      ? (row as SavedVocabularyItem).meaning
                      : (row as UnlockedVocabularyItem).meanings.join(', ')}
                  </td>
                  <td className="px-3 py-2 text-prose-secondary">
                    {tab === 'saved'
                      ? (row as SavedVocabularyItem).readings.join(' / ') || '-'
                      : (row as UnlockedVocabularyItem).readings.join(' / ') || '-'}
                  </td>
                  <td className="px-3 py-2 text-prose-secondary">
                    L{tab === 'saved' ? (row as SavedVocabularyItem).level ?? '-' : (row as UnlockedVocabularyItem).level} · SRS{' '}
                    {tab === 'saved' ? (row as SavedVocabularyItem).srsStage ?? '-' : (row as UnlockedVocabularyItem).srsStage}
                  </td>
                  {tab === 'saved' && (
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleRemove((row as SavedVocabularyItem).token)}
                        className="text-xs rounded-md bg-danger-50 px-2.5 py-1 text-danger-600 hover:bg-danger-100"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
