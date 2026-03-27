import { useEffect, useMemo, useState } from 'react';
import { StorageService } from '../services/storage';
import { Pagination } from '../components/Pagination';

type VocabItem = {
  id: number;
  word: string;
  meaning: string;
  level: number;
  srs: number;
};

const PAGE_SIZE = 12;

export function VocabularyPage() {
  const [items, setItems] = useState<VocabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLevel, setActiveLevel] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      const data = await StorageService.getWaniKaniData();
      if (!data) {
        setLoading(false);
        return;
      }

      const mapped: VocabItem[] = data.assignments
        .map((assignment) => {
          const subject = data.subjects.get(assignment.data.subject_id);
          if (!subject || (subject.type !== 'vocabulary' && subject.type !== 'kana_vocabulary')) return null;
          if (!subject.data.characters) return null;

          return {
            id: subject.id,
            word: subject.data.characters,
            meaning: subject.data.meanings?.[0]?.meaning ?? '-',
            level: subject.data.level ?? 0,
            srs: assignment.data.srs_stage,
          };
        })
        .filter((x): x is VocabItem => !!x)
        .sort((a, b) => a.level - b.level || a.word.localeCompare(b.word, 'ja'));

      setItems(mapped);
      setLoading(false);
    };

    load();
  }, []);

  const levels = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.level))).sort((a, b) => a - b);
  }, [items]);

  useEffect(() => {
    if (activeLevel === null && levels.length > 0) {
      setActiveLevel(levels[0]);
    }
  }, [levels, activeLevel]);

  const filtered = useMemo(() => {
    if (activeLevel === null) return [];
    return items.filter((i) => i.level === activeLevel);
  }, [items, activeLevel]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [activeLevel]);

  return (
    <div className="container max-w-6xl mx-auto py-6 px-4 pb-24 md:pb-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Vocabulary</h1>
      <p className="text-gray-600 mb-6">Showing unlocked vocabulary only, grouped by WaniKani level.</p>

      {loading ? (
        <div className="card">Loading vocabulary...</div>
      ) : items.length === 0 ? (
        <div className="card">No unlocked vocabulary yet.</div>
      ) : (
        <>
          <div className="mb-4 max-w-xs">
            <label htmlFor="vocabulary-level" className="mb-2 block text-sm font-medium text-gray-700">
              Level
            </label>
            <select
              id="vocabulary-level"
              value={activeLevel ?? ''}
              onChange={(e) => setActiveLevel(Number(e.target.value))}
              className="input-field"
            >
              {levels.map((level) => (
                <option key={level} value={level}>
                  Level {level}
                </option>
              ))}
            </select>
          </div>

          <div className="card overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-700">
                  <th className="px-3 py-2">Vocabulary</th>
                  <th className="px-3 py-2">Meaning</th>
                  <th className="px-3 py-2">Level</th>
                  <th className="px-3 py-2">SRS</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 text-base">{row.word}</td>
                    <td className="px-3 py-2">{row.meaning}</td>
                    <td className="px-3 py-2">{row.level}</td>
                    <td className="px-3 py-2">{row.srs}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
