import { useEffect, useMemo, useState } from 'react';
import { StorageService } from '../services/storage';
import { WaniKaniData } from '../types';
import { TableColumn, TableModal } from '../components/TableModal';

type ModalKey = 'assignments' | 'kanji' | 'vocabulary' | 'reviews' | null;

interface ResourceTables {
  assignments: Array<Record<string, string | number | null>>;
  kanji: Array<Record<string, string | number | null>>;
  vocabulary: Array<Record<string, string | number | null>>;
  reviews: Array<Record<string, string | number | null>>;
}

const columnsByModal: Record<Exclude<ModalKey, null>, TableColumn[]> = {
  assignments: [
    { key: 'id', label: 'ID' },
    { key: 'type', label: 'Type' },
    { key: 'subject', label: 'Subject' },
    { key: 'level', label: 'Level' },
    { key: 'srs', label: 'SRS' },
    { key: 'unlockedAt', label: 'Unlocked At' },
  ],
  kanji: [
    { key: 'char', label: 'Kanji' },
    { key: 'meaning', label: 'Meaning' },
    { key: 'level', label: 'Level' },
    { key: 'srs', label: 'SRS' },
  ],
  vocabulary: [
    { key: 'word', label: 'Vocabulary' },
    { key: 'meaning', label: 'Meaning' },
    { key: 'level', label: 'Level' },
    { key: 'srs', label: 'SRS' },
  ],
  reviews: [
    { key: 'id', label: 'ID' },
    { key: 'subject', label: 'Subject' },
    { key: 'createdAt', label: 'Created At' },
    { key: 'startSrs', label: 'Start SRS' },
    { key: 'endSrs', label: 'End SRS' },
    { key: 'incorrect', label: 'Incorrect Total' },
  ],
};

function formatDate(iso?: string | null): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function buildTables(data: WaniKaniData): ResourceTables {
  const assignments = data.assignments.map((a) => {
    const subject = data.subjects.get(a.data.subject_id);
    return {
      id: a.id,
      type: subject?.type ?? '-',
      subject: subject?.data.characters ?? subject?.data.slug ?? '-',
      level: subject?.data.level ?? '-',
      srs: a.data.srs_stage,
      unlockedAt: formatDate(a.data.unlocked_at),
    };
  });

  const kanji = data.assignments
    .map((a) => ({ assignment: a, subject: data.subjects.get(a.data.subject_id) }))
    .filter(({ subject }) => subject?.type === 'kanji')
    .map(({ assignment, subject }) => ({
      char: subject?.data.characters ?? '-',
      meaning: subject?.data.meanings?.[0]?.meaning ?? '-',
      level: subject?.data.level ?? '-',
      srs: assignment.data.srs_stage,
    }))
    .sort((a, b) => Number(a.level) - Number(b.level));

  const vocabulary = data.assignments
    .map((a) => ({ assignment: a, subject: data.subjects.get(a.data.subject_id) }))
    .filter(({ subject }) => subject?.type === 'vocabulary' || subject?.type === 'kana_vocabulary')
    .map(({ assignment, subject }) => ({
      word: subject?.data.characters ?? '-',
      meaning: subject?.data.meanings?.[0]?.meaning ?? '-',
      level: subject?.data.level ?? '-',
      srs: assignment.data.srs_stage,
    }))
    .sort((a, b) => Number(a.level) - Number(b.level));

  const reviews = data.reviews.map((r) => {
    const subject = data.subjects.get(r.data.subject_id);
    const incorrectMeaning = r.data.incorrect_meaning_answers ?? 0;
    const incorrectReading = r.data.incorrect_reading_answers ?? 0;
    return {
      id: r.id,
      subject: subject?.data.characters ?? subject?.data.slug ?? '-',
      createdAt: formatDate(r.data.created_at),
      startSrs: r.data.starting_srs_stage,
      endSrs: r.data.ending_srs_stage,
      incorrect: incorrectMeaning + incorrectReading,
    };
  });

  return {
    assignments,
    kanji,
    vocabulary,
    reviews,
  };
}

export function UserPage() {
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [tables, setTables] = useState<ResourceTables>({
    assignments: [],
    kanji: [],
    vocabulary: [],
    reviews: [],
  });
  const [openModal, setOpenModal] = useState<ModalKey>(null);

  useEffect(() => {
    const load = async () => {
      const data = await StorageService.getWaniKaniData();
      if (!data) {
        setLoading(false);
        return;
      }

      setUserInfo(data.user);
      setTables(buildTables(data));
      setLoading(false);
    };

    load();
  }, []);

  const counts = useMemo(
    () => ({
      assignments: tables.assignments.length,
      kanji: tables.kanji.length,
      vocabulary: tables.vocabulary.length,
      reviews: tables.reviews.length,
    }),
    [tables]
  );

  return (
    <div className="container max-w-6xl mx-auto py-6 px-4 pb-24 md:pb-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">WaniKani User</h1>
      <p className="text-gray-600 mb-6">Click a card to open its table (12 rows per page).</p>

      {loading ? (
        <div className="card">Loading user data...</div>
      ) : !userInfo ? (
        <div className="card">No WaniKani data found. Reconnect from setup.</div>
      ) : (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Profile</h2>
            <p><span className="font-medium">Username:</span> {userInfo.username}</p>
            <p><span className="font-medium">Level:</span> {userInfo.level}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button className="card text-left" onClick={() => setOpenModal('assignments')}>
              <p className="text-2xl font-bold text-blue-600">{counts.assignments}</p>
              <p className="text-gray-600">Assignments</p>
            </button>
            <button className="card text-left" onClick={() => setOpenModal('kanji')}>
              <p className="text-2xl font-bold text-indigo-600">{counts.kanji}</p>
              <p className="text-gray-600">User Kanji</p>
            </button>
            <button className="card text-left" onClick={() => setOpenModal('vocabulary')}>
              <p className="text-2xl font-bold text-green-600">{counts.vocabulary}</p>
              <p className="text-gray-600">User Vocabulary</p>
            </button>
            <button className="card text-left" onClick={() => setOpenModal('reviews')}>
              <p className="text-2xl font-bold text-amber-600">{counts.reviews}</p>
              <p className="text-gray-600">Reviews</p>
            </button>
          </div>
        </div>
      )}

      {openModal && (
        <TableModal
          isOpen={!!openModal}
          title={openModal.charAt(0).toUpperCase() + openModal.slice(1)}
          rows={tables[openModal]}
          columns={columnsByModal[openModal]}
          onClose={() => setOpenModal(null)}
          pageSize={12}
        />
      )}
    </div>
  );
}
