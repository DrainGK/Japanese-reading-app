import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { passages } from '../data/passages';
import { Pagination } from '../components/Pagination';
import { StorageService } from '../services/storage';
import { ReadingPassage, WaniKaniData, WaniKaniSubject } from '../types';
import {
  countMatchingVocabularyInPassage,
  getMatchingVocabularyTokens,
  hasMatchingVocabularyInPassage,
} from '../lib/passageMatching';

const PAGE_SIZE = 4;
const STATS_PAGE_SIZE = 5;
const sourceOptions: Array<'all' | 'local' | 'aozora'> = ['all', 'local', 'aozora'];
const textLevelOptions: Array<'all' | ReadingPassage['difficulty']> = [
  'all',
  'easy',
  'normal',
  'hard',
];
const filterModes = ['all', 'assignments', 'reviews'] as const;
const assignmentKinds = ['kanji', 'vocabulary'] as const;

type FilterMode = (typeof filterModes)[number];
type AssignmentKind = (typeof assignmentKinds)[number];
type LevelSelectValue = '' | `${number}`;
type StatsKind = 'kanji' | 'vocabulary';

type LevelStat = {
  level: number;
  matched: number;
  total: number;
  percentage: number;
};

function getSubjectCharacter(subject: WaniKaniSubject): string | null {
  return subject.data.characters ?? subject.data.slug ?? null;
}

function getVocabularyToken(subject: WaniKaniSubject): string | null {
  return subject.data.characters ?? subject.data.slug ?? null;
}

function getFilteredAssignmentSubjects(
  data: WaniKaniData,
  assignmentKind: AssignmentKind,
  useCurrentLevel: boolean,
  moreThanLevel: LevelSelectValue,
  lessThanLevel: LevelSelectValue,
  exactLevel: LevelSelectValue
): WaniKaniSubject[] {
  const currentLevel = data.user?.level ?? 1;
  const subjects = new Map<number, WaniKaniSubject>();

  data.assignments.forEach((assignment) => {
    const subject = data.subjects.get(assignment.data.subject_id);
    if (!subject) return;

    const isWantedType =
      assignmentKind === 'kanji'
        ? subject.type === 'kanji'
        : subject.type === 'vocabulary' || subject.type === 'kana_vocabulary';

    if (!isWantedType) return;

    const subjectLevel = subject.data.level ?? 0;
    const matchesLevel = useCurrentLevel
      ? subjectLevel === currentLevel
      : moreThanLevel
      ? subjectLevel > Number(moreThanLevel)
      : lessThanLevel
      ? subjectLevel < Number(lessThanLevel)
      : exactLevel
      ? subjectLevel === Number(exactLevel)
      : true;

    if (!matchesLevel) return;

    subjects.set(subject.id, subject);
  });

  return Array.from(subjects.values());
}

function getReviewedSubjects(data: WaniKaniData): WaniKaniSubject[] {
  const subjects = new Map<number, WaniKaniSubject>();

  data.reviews.forEach((review) => {
    const subject = data.subjects.get(review.data.subject_id);
    if (!subject) return;
    if (subject.type !== 'kanji' && subject.type !== 'vocabulary' && subject.type !== 'kana_vocabulary') {
      return;
    }

    subjects.set(subject.id, subject);
  });

  return Array.from(subjects.values());
}

function getUnlockedKanjiSubjects(data: WaniKaniData): WaniKaniSubject[] {
  const subjects = new Map<number, WaniKaniSubject>();

  data.assignments.forEach((assignment) => {
    const subject = data.subjects.get(assignment.data.subject_id);
    if (!subject || subject.type !== 'kanji') return;

    subjects.set(subject.id, subject);
  });

  return Array.from(subjects.values());
}

function getUnlockedVocabularySubjects(data: WaniKaniData): WaniKaniSubject[] {
  const subjects = new Map<number, WaniKaniSubject>();

  data.assignments.forEach((assignment) => {
    const subject = data.subjects.get(assignment.data.subject_id);
    if (!subject) return;
    if (subject.type !== 'vocabulary' && subject.type !== 'kana_vocabulary') return;

    subjects.set(subject.id, subject);
  });

  return Array.from(subjects.values());
}

function buildSubjectTokenSet(subjects: WaniKaniSubject[], kind: AssignmentKind | 'all'): Set<string> {
  const tokens = new Set<string>();

  subjects.forEach((subject) => {
    if (kind === 'kanji') {
      if (subject.type !== 'kanji') return;
      const token = getSubjectCharacter(subject);
      if (token) tokens.add(token);
      return;
    }

    if (kind === 'vocabulary') {
      if (subject.type !== 'vocabulary' && subject.type !== 'kana_vocabulary') return;
      const token = getVocabularyToken(subject);
      if (token) tokens.add(token);
      return;
    }

    if (subject.type === 'kanji') {
      const token = getSubjectCharacter(subject);
      if (token) tokens.add(token);
      return;
    }

    if (subject.type === 'vocabulary' || subject.type === 'kana_vocabulary') {
      const token = getVocabularyToken(subject);
      if (token) tokens.add(token);
    }
  });

  return tokens;
}

function countMatchingKanji(
  passage: ReadingPassage,
  activeKanjiCharacters: Set<string>
): number {
  return passage.kanjiList.filter((kanji) => activeKanjiCharacters.has(kanji)).length;
}

function passageMatchesFilter(
  passage: ReadingPassage,
  filterMode: FilterMode,
  assignmentKind: AssignmentKind,
  assignmentTokens: Set<string>,
  reviewTokens: Set<string>
): boolean {
  if (filterMode === 'assignments') {
    if (assignmentKind === 'kanji') {
      return passage.kanjiList.some((token) => assignmentTokens.has(token));
    }

    return hasMatchingVocabularyInPassage(passage, assignmentTokens);
  }

  if (filterMode === 'reviews') {
    return (
      passage.kanjiList.some((token) => reviewTokens.has(token)) ||
      hasMatchingVocabularyInPassage(passage, reviewTokens)
    );
  }

  return true;
}

export function TextsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [wkData, setWkData] = useState<WaniKaniData | null>(null);
  const [genre, setGenre] = useState<string>('all');
  const [source, setSource] = useState<'all' | 'local' | 'aozora'>('all');
  const [textLevel, setTextLevel] = useState<'all' | ReadingPassage['difficulty']>('all');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [assignmentKind, setAssignmentKind] = useState<AssignmentKind>('kanji');
  const [useCurrentLevel, setUseCurrentLevel] = useState(true);
  const [moreThanLevel, setMoreThanLevel] = useState<LevelSelectValue>('');
  const [lessThanLevel, setLessThanLevel] = useState<LevelSelectValue>('');
  const [exactLevel, setExactLevel] = useState<LevelSelectValue>('');
  const [minimumKanjiMatches, setMinimumKanjiMatches] = useState(1);
  const [minimumVocabularyMatches, setMinimumVocabularyMatches] = useState(1);
  const [page, setPage] = useState(1);
  const [statsPage, setStatsPage] = useState(1);
  const [statsOpen, setStatsOpen] = useState(false);
  const [selectedStatsPassage, setSelectedStatsPassage] = useState<ReadingPassage | null>(null);
  const [selectedStatsKind, setSelectedStatsKind] = useState<StatsKind>('kanji');

  useEffect(() => {
    const load = async () => {
      const data = await StorageService.getWaniKaniData();
      setWkData(data);
      setLoading(false);
    };

    load();
  }, []);

  const genreOptions = useMemo(() => {
    return ['all', ...Array.from(new Set(passages.map((passage) => passage.theme))).sort()];
  }, []);

  const assignmentSubjects = useMemo(() => {
    if (!wkData) return [];

    return getFilteredAssignmentSubjects(
      wkData,
      assignmentKind,
      useCurrentLevel,
      moreThanLevel,
      lessThanLevel,
      exactLevel
    );
  }, [wkData, assignmentKind, useCurrentLevel, moreThanLevel, lessThanLevel, exactLevel]);

  const allUnlockedLevels = useMemo(() => {
    if (!wkData) return [];

    const levels = new Set<number>();
    wkData.assignments.forEach((assignment) => {
      const subject = wkData.subjects.get(assignment.data.subject_id);
      if (!subject) return;

      const isWantedType =
        assignmentKind === 'kanji'
          ? subject.type === 'kanji'
          : subject.type === 'vocabulary' || subject.type === 'kana_vocabulary';

      if (!isWantedType) return;
      if (subject.data.level) {
        levels.add(subject.data.level);
      }
    });

    return Array.from(levels).sort((a, b) => a - b);
  }, [wkData, assignmentKind]);

  const reviewedSubjects = useMemo(() => {
    if (!wkData) return [];
    return getReviewedSubjects(wkData);
  }, [wkData]);

  const unlockedKanjiSubjects = useMemo(() => {
    if (!wkData) return [];
    return getUnlockedKanjiSubjects(wkData);
  }, [wkData]);

  const unlockedVocabularySubjects = useMemo(() => {
    if (!wkData) return [];
    return getUnlockedVocabularySubjects(wkData);
  }, [wkData]);

  const assignmentTokens = useMemo(() => {
    return buildSubjectTokenSet(assignmentSubjects, assignmentKind);
  }, [assignmentSubjects, assignmentKind]);

  const reviewTokens = useMemo(() => {
    return buildSubjectTokenSet(reviewedSubjects, 'all');
  }, [reviewedSubjects]);

  const activeKanjiSubjects = useMemo(() => {
    if (filterMode === 'all') {
      return unlockedKanjiSubjects;
    }

    if (filterMode === 'assignments' && assignmentKind === 'kanji') {
      return assignmentSubjects.filter((subject) => subject.type === 'kanji');
    }

    if (filterMode === 'reviews') {
      return reviewedSubjects.filter((subject) => subject.type === 'kanji');
    }

    return [];
  }, [filterMode, assignmentKind, assignmentSubjects, reviewedSubjects, unlockedKanjiSubjects]);

  const activeVocabularySubjects = useMemo(() => {
    if (filterMode === 'all') {
      return unlockedVocabularySubjects;
    }

    if (filterMode === 'assignments' && assignmentKind === 'vocabulary') {
      return assignmentSubjects.filter(
        (subject) => subject.type === 'vocabulary' || subject.type === 'kana_vocabulary'
      );
    }

    if (filterMode === 'reviews') {
      return reviewedSubjects.filter(
        (subject) => subject.type === 'vocabulary' || subject.type === 'kana_vocabulary'
      );
    }

    return [];
  }, [filterMode, assignmentKind, assignmentSubjects, reviewedSubjects, unlockedVocabularySubjects]);

  const activeKanjiCharacters = useMemo(() => {
    const characters = new Set<string>();
    activeKanjiSubjects.forEach((subject) => {
      const character = getSubjectCharacter(subject);
      if (character) {
        characters.add(character);
      }
    });
    return characters;
  }, [activeKanjiSubjects]);

  const activeVocabularyTokens = useMemo(() => {
    return buildSubjectTokenSet(activeVocabularySubjects, 'vocabulary');
  }, [activeVocabularySubjects]);

  useEffect(() => {
    if (allUnlockedLevels.length === 0) {
      setMoreThanLevel('');
      setLessThanLevel('');
      setExactLevel('');
      setUseCurrentLevel(true);
      return;
    }

    if (moreThanLevel && !allUnlockedLevels.includes(Number(moreThanLevel))) {
      setMoreThanLevel('');
    }

    if (lessThanLevel && !allUnlockedLevels.includes(Number(lessThanLevel))) {
      setLessThanLevel('');
    }

    if (exactLevel && !allUnlockedLevels.includes(Number(exactLevel))) {
      setExactLevel('');
    }
  }, [allUnlockedLevels, moreThanLevel, lessThanLevel, exactLevel]);

  useEffect(() => {
    const maxMatches = Math.max(activeKanjiCharacters.size, 1);
    if (minimumKanjiMatches > maxMatches) {
      setMinimumKanjiMatches(maxMatches);
    }
  }, [activeKanjiCharacters.size, minimumKanjiMatches]);

  useEffect(() => {
    const maxMatches = Math.max(activeVocabularyTokens.size, 1);
    if (minimumVocabularyMatches > maxMatches) {
      setMinimumVocabularyMatches(maxMatches);
    }
  }, [activeVocabularyTokens.size, minimumVocabularyMatches]);

  const baseFiltered = useMemo(() => {
    return passages.filter((passage) => {
      if (genre !== 'all' && passage.theme !== genre) return false;
      if (source !== 'all' && (passage.source ?? 'local') !== source) return false;
      if (textLevel !== 'all' && passage.difficulty !== textLevel) return false;

      return passageMatchesFilter(
        passage,
        filterMode,
        assignmentKind,
        assignmentTokens,
        reviewTokens
      );
    });
  }, [genre, source, textLevel, filterMode, assignmentKind, assignmentTokens, reviewTokens]);

  const filtered = useMemo(() => {
    return baseFiltered.filter((passage) => {
      if (
        filterMode !== 'all' &&
        activeKanjiCharacters.size > 0 &&
        countMatchingKanji(passage, activeKanjiCharacters) < minimumKanjiMatches
      ) {
        return false;
      }

      if (
        filterMode !== 'all' &&
        activeVocabularyTokens.size > 0 &&
        countMatchingVocabularyInPassage(passage, activeVocabularyTokens) < minimumVocabularyMatches
      ) {
        return false;
      }

      return true;
    });
  }, [
    baseFiltered,
    activeKanjiCharacters,
    minimumKanjiMatches,
    activeVocabularyTokens,
    minimumVocabularyMatches,
    filterMode,
  ]);

  const maxMatchingKanjiInBaseTexts = useMemo(() => {
    if (activeKanjiCharacters.size === 0 || baseFiltered.length === 0) {
      return 0;
    }

    return baseFiltered.reduce((maxMatches, passage) => {
      return Math.max(maxMatches, countMatchingKanji(passage, activeKanjiCharacters));
    }, 0);
  }, [baseFiltered, activeKanjiCharacters]);

  const maxMatchingVocabularyInBaseTexts = useMemo(() => {
    if (activeVocabularyTokens.size === 0 || baseFiltered.length === 0) {
      return 0;
    }

    return baseFiltered.reduce((maxMatches, passage) => {
      const matches = countMatchingVocabularyInPassage(passage, activeVocabularyTokens);
      return Math.max(maxMatches, matches);
    }, 0);
  }, [baseFiltered, activeVocabularyTokens]);

  useEffect(() => {
    setPage(1);
  }, [
    genre,
    source,
    textLevel,
    filterMode,
    assignmentKind,
    useCurrentLevel,
    moreThanLevel,
    lessThanLevel,
    exactLevel,
    minimumKanjiMatches,
    minimumVocabularyMatches,
  ]);

  useEffect(() => {
    if (activeKanjiCharacters.size === 0) {
      return;
    }

    const highestValidThreshold = Math.max(1, maxMatchingKanjiInBaseTexts);
    if (minimumKanjiMatches > highestValidThreshold) {
      setMinimumKanjiMatches(highestValidThreshold);
    }
  }, [minimumKanjiMatches, maxMatchingKanjiInBaseTexts, activeKanjiCharacters.size]);

  useEffect(() => {
    if (activeVocabularyTokens.size === 0) {
      return;
    }

    const highestValidThreshold = Math.max(1, maxMatchingVocabularyInBaseTexts);
    if (minimumVocabularyMatches > highestValidThreshold) {
      setMinimumVocabularyMatches(highestValidThreshold);
    }
  }, [minimumVocabularyMatches, maxMatchingVocabularyInBaseTexts, activeVocabularyTokens.size]);

  useEffect(() => {
    setStatsPage(1);
  }, [filterMode, assignmentKind, useCurrentLevel, moreThanLevel, lessThanLevel, exactLevel, genre, source, textLevel]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const matchedKanjiAcrossBaseTexts = useMemo(() => {
    const matched = new Set<string>();

    baseFiltered.forEach((passage) => {
      passage.kanjiList.forEach((kanji) => {
        if (activeKanjiCharacters.has(kanji)) {
          matched.add(kanji);
        }
      });
    });

    return matched;
  }, [baseFiltered, activeKanjiCharacters]);

  const matchedVocabularyAcrossBaseTexts = useMemo(() => {
    const matched = new Set<string>();

    baseFiltered.forEach((passage) => {
      getMatchingVocabularyTokens(passage.text, activeVocabularyTokens).forEach((vocab) =>
        matched.add(vocab)
      );
    });

    return matched;
  }, [baseFiltered, activeVocabularyTokens]);

  const matchedKanjiForSelectedPassage = useMemo(() => {
    if (!selectedStatsPassage) {
      return selectedStatsKind === 'kanji'
        ? matchedKanjiAcrossBaseTexts
        : matchedVocabularyAcrossBaseTexts;
    }

    const matched = new Set<string>();
    if (selectedStatsKind === 'kanji') {
      selectedStatsPassage.kanjiList.forEach((kanji) => {
        if (activeKanjiCharacters.has(kanji)) {
          matched.add(kanji);
        }
      });
    } else {
      selectedStatsPassage.vocabList.forEach((vocab) => {
        if (activeVocabularyTokens.has(vocab)) {
          matched.add(vocab);
        }
      });
      getMatchingVocabularyTokens(selectedStatsPassage.text, activeVocabularyTokens).forEach((vocab) =>
        matched.add(vocab)
      );
    }

    return matched;
  }, [
    selectedStatsPassage,
    selectedStatsKind,
    matchedKanjiAcrossBaseTexts,
    matchedVocabularyAcrossBaseTexts,
    activeKanjiCharacters,
    activeVocabularyTokens,
  ]);

  const levelStats = useMemo<LevelStat[]>(() => {
    const grouped = new Map<number, { matched: number; total: number }>();

    const activeSubjects = selectedStatsKind === 'kanji' ? activeKanjiSubjects : activeVocabularySubjects;

    activeSubjects.forEach((subject) => {
      const level = subject.data.level ?? 0;
      const token =
        selectedStatsKind === 'kanji' ? getSubjectCharacter(subject) : getVocabularyToken(subject);
      if (!token) return;

      const current = grouped.get(level) ?? { matched: 0, total: 0 };
      current.total += 1;

      if (matchedKanjiForSelectedPassage.has(token)) {
        current.matched += 1;
      }

      grouped.set(level, current);
    });

    return Array.from(grouped.entries())
      .map(([level, stat]) => ({
        level,
        matched: stat.matched,
        total: stat.total,
        percentage: stat.total === 0 ? 0 : Math.round((stat.matched / stat.total) * 100),
      }))
      .sort((a, b) => a.level - b.level);
  }, [selectedStatsKind, activeKanjiSubjects, activeVocabularySubjects, matchedKanjiForSelectedPassage]);

  const statsTotalPages = Math.max(1, Math.ceil(levelStats.length / STATS_PAGE_SIZE));
  const levelStatsRows = levelStats.slice(
    (statsPage - 1) * STATS_PAGE_SIZE,
    statsPage * STATS_PAGE_SIZE
  );

  const hasReviews = reviewedSubjects.length > 0;
  const totalActiveKanji = activeKanjiCharacters.size;
  const totalActiveVocabulary = activeVocabularyTokens.size;
  const matchedGlobalKanji = matchedKanjiAcrossBaseTexts.size;
  const matchedGlobalVocabulary = matchedVocabularyAcrossBaseTexts.size;
  const totalActiveStatsTokens =
    selectedStatsKind === 'kanji' ? totalActiveKanji : totalActiveVocabulary;
  const matchedActiveStatsTokens = matchedKanjiForSelectedPassage.size;

  const openGlobalStats = () => {
    setSelectedStatsPassage(null);
    setSelectedStatsKind('kanji');
    setStatsOpen(true);
  };

  const openGlobalVocabularyStats = () => {
    setSelectedStatsPassage(null);
    setSelectedStatsKind('vocabulary');
    setStatsOpen(true);
  };

  const openPassageStats = (passage: ReadingPassage, kind: StatsKind) => {
    setSelectedStatsPassage(passage);
    setSelectedStatsKind(kind);
    setStatsOpen(true);
  };

  const handleCurrentLevelClick = () => {
    setUseCurrentLevel(true);
    setMoreThanLevel('');
    setLessThanLevel('');
    setExactLevel('');
  };

  const handleMoreThanChange = (value: LevelSelectValue) => {
    setMoreThanLevel(value);
    setLessThanLevel('');
    setExactLevel('');
    setUseCurrentLevel(false);
  };

  const handleLessThanChange = (value: LevelSelectValue) => {
    setLessThanLevel(value);
    setMoreThanLevel('');
    setExactLevel('');
    setUseCurrentLevel(false);
  };

  const handleExactLevelChange = (value: LevelSelectValue) => {
    setExactLevel(value);
    setMoreThanLevel('');
    setLessThanLevel('');
    setUseCurrentLevel(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-prose">Texts</h1>
        <p className="text-prose-secondary text-sm">
          Browse texts by genre, level, and your WaniKani progress
        </p>
      </div>

      <div className="card space-y-5">
        {/* Basic Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-sm font-medium text-prose">
            Genre
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="mt-1.5 input-field"
            >
              {genreOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-prose">
            Source
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as 'all' | 'local' | 'aozora')}
              className="mt-1.5 input-field"
            >
              {sourceOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-prose">
            Difficulty
            <select
              value={textLevel}
              onChange={(e) => setTextLevel(e.target.value as 'all' | ReadingPassage['difficulty'])}
              className="mt-1.5 input-field"
            >
              {textLevelOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* WaniKani Filter Tabs */}
        <div>
          <p className="mb-2 text-sm font-medium text-prose">WaniKani Content</p>
          <div className="flex flex-wrap gap-2">
            {filterModes.map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  filterMode === mode
                    ? 'bg-primary-400 text-prose-inverse'
                    : 'bg-muted text-prose hover:bg-hover'
                }`}
              >
                {mode === 'all' ? 'All Text' : mode === 'assignments' ? 'Unlocked' : 'Reviewed'}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Filters - shown when assignments filter is active */}
        {filterMode === 'assignments' && (
          <div className="space-y-4 border-t border-stroke-subtle pt-4">
            <div>
              <p className="mb-2 text-sm font-medium text-prose">Type</p>
              <div className="flex flex-wrap gap-2">
                {assignmentKinds.map((kind) => (
                  <button
                    key={kind}
                    onClick={() => setAssignmentKind(kind)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                      assignmentKind === kind
                        ? 'bg-primary-400 text-prose-inverse'
                        : 'bg-muted text-prose hover:bg-hover'
                    }`}
                  >
                    {kind === 'kanji' ? 'Kanji' : 'Vocabulary'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-prose">Level</p>
              <button
                onClick={handleCurrentLevelClick}
                className={`mb-3 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  useCurrentLevel
                    ? 'bg-primary-400 text-prose-inverse'
                    : 'bg-muted text-prose hover:bg-hover'
                }`}
              >
                Current Level
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="text-sm font-medium text-prose">
                  More Than
                  <select
                    value={moreThanLevel}
                    onChange={(e) => handleMoreThanChange(e.target.value as LevelSelectValue)}
                    className="mt-1.5 input-field"
                  >
                    <option value="">Off</option>
                    {allUnlockedLevels.map((level) => (
                      <option key={`more-${level}`} value={level}>
                        Level {level}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-gray-700">
                  Less Than
                  <select
                    value={lessThanLevel}
                    onChange={(e) => handleLessThanChange(e.target.value as LevelSelectValue)}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2"
                  >
                    <option value="">Off</option>
                    {allUnlockedLevels.map((level) => (
                      <option key={`less-${level}`} value={level}>
                        Level {level}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-gray-700">
                  Level
                  <select
                    value={exactLevel}
                    onChange={(e) => handleExactLevelChange(e.target.value as LevelSelectValue)}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2"
                  >
                    <option value="">Off</option>
                    {allUnlockedLevels.map((level) => (
                      <option key={`exact-${level}`} value={level}>
                        Level {level}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {!loading && allUnlockedLevels.length === 0 && (
              <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                There are no unlocked {assignmentKind === 'kanji' ? 'kanjis' : 'vocabulary'}.
              </div>
            )}
          </div>
        )}

        {filterMode === 'reviews' && !loading && !hasReviews && (
          <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            There is no review.
          </div>
        )}

        {filterMode !== 'all' && totalActiveKanji > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-gray-700">Kanji Match Threshold</p>
              <button
                onClick={openGlobalStats}
                className="rounded bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-100"
                title="Open kanji match stats"
              >
                {minimumKanjiMatches} / {totalActiveKanji}
              </button>
            </div>

            <input
              type="range"
              min={1}
              max={totalActiveKanji}
              value={minimumKanjiMatches}
              onChange={(e) => {
                const nextValue = Number(e.target.value);
                const highestValidThreshold = Math.max(1, maxMatchingKanjiInBaseTexts);
                setMinimumKanjiMatches(Math.min(nextValue, highestValidThreshold));
              }}
              className="w-full"
            />

            <p className="mt-2 text-sm text-gray-600">
              {`Show only texts with at least ${minimumKanjiMatches} matching kanji from the active filter.`}
            </p>
          </div>
        )}

        {filterMode !== 'all' && activeVocabularyTokens.size > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-gray-700">Vocabulary Match Threshold</p>
              <button
                onClick={openGlobalVocabularyStats}
                className="rounded bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                title="Open vocabulary match stats"
              >
                {minimumVocabularyMatches} / {activeVocabularyTokens.size}
              </button>
            </div>

            <input
              type="range"
              min={1}
              max={activeVocabularyTokens.size}
              value={minimumVocabularyMatches}
              onChange={(e) => {
                const nextValue = Number(e.target.value);
                const highestValidThreshold = Math.max(1, maxMatchingVocabularyInBaseTexts);
                setMinimumVocabularyMatches(Math.min(nextValue, highestValidThreshold));
              }}
              className="w-full"
            />

            <p className="mt-2 text-sm text-gray-600">
              {`Show only texts with at least ${minimumVocabularyMatches} matching vocabulary from the active filter.`}
            </p>
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-800">Corpus Texts</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <span>{filtered.length} texts</span>
          {totalActiveKanji > 0 && (
            <button
              onClick={openGlobalStats}
              className="rounded bg-gray-100 px-3 py-1 text-gray-700 hover:bg-gray-200"
              title="Open kanji match stats"
            >
              {matchedGlobalKanji} / {totalActiveKanji} matching kanji
            </button>
          )}
          {totalActiveVocabulary > 0 && (
            <button
              onClick={openGlobalVocabularyStats}
              className="rounded bg-gray-100 px-3 py-1 text-gray-700 hover:bg-gray-200"
              title="Open vocabulary match stats"
            >
              {matchedGlobalVocabulary} / {totalActiveVocabulary} matching vocab
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card text-gray-600">Loading texts...</div>
      ) : (
        <>
          <div className="space-y-4">
            {pageRows.map((passage) => {
              const kanjiMatches =
                totalActiveKanji > 0 ? countMatchingKanji(passage, activeKanjiCharacters) : 0;
              const vocabularyMatches =
                totalActiveVocabulary > 0
                  ? countMatchingVocabularyInPassage(passage, activeVocabularyTokens)
                  : 0;

              return (
                <div key={passage.id} className="card">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-indigo-100 px-2 py-1 text-indigo-700">{passage.theme}</span>
                    <span className="rounded bg-gray-100 px-2 py-1 text-gray-700">{passage.source ?? 'local'}</span>
                    <span className="rounded bg-gray-100 px-2 py-1 text-gray-700">{passage.difficulty}</span>
                    {totalActiveKanji > 0 && (
                      <button
                        type="button"
                        onClick={() => openPassageStats(passage, 'kanji')}
                        className="rounded bg-blue-100 px-2 py-1 text-blue-700 hover:bg-blue-200"
                        title="Open kanji match stats"
                      >
                        {kanjiMatches} / {totalActiveKanji} kanji
                      </button>
                    )}
                    {totalActiveVocabulary > 0 && (
                      <button
                        type="button"
                        onClick={() => openPassageStats(passage, 'vocabulary')}
                        className="rounded bg-emerald-100 px-2 py-1 text-emerald-700 hover:bg-emerald-200"
                        title="Open vocabulary match stats"
                      >
                        {vocabularyMatches} / {totalActiveVocabulary} vocab
                      </button>
                    )}
                  </div>
                  <h2 className="text-xl font-semibold text-gray-800">{passage.title}</h2>
                  <p className="mt-1 text-gray-600">{passage.summary}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-gray-500">~{passage.estimatedMinutes} min</span>
                    <button onClick={() => navigate(`/reading/${passage.id}`)} className="btn btn-primary">
                      Read
                    </button>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="card text-gray-600">
                {filterMode === 'reviews' && !hasReviews ? 'There is no review.' : 'No text found.'}
              </div>
            )}
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {statsOpen && totalActiveStatsTokens > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">
                  {selectedStatsPassage
                    ? selectedStatsPassage.title
                    : selectedStatsKind === 'kanji'
                    ? 'Kanji Match Stats'
                    : 'Vocabulary Match Stats'}
                </h3>
                <p className="text-sm text-gray-600">
                  {selectedStatsPassage
                    ? `${selectedStatsKind === 'kanji' ? 'Kanji' : 'Vocabulary'} coverage for this text only.`
                    : `${selectedStatsKind === 'kanji' ? 'Kanji' : 'Vocabulary'} coverage by level for the current text filter set.`}
                </p>
              </div>
              <button
                onClick={() => {
                  setStatsOpen(false);
                  setSelectedStatsPassage(null);
                }}
                className="rounded bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200"
              >
                Close
              </button>
            </div>

            {selectedStatsPassage && (
              <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <p className="font-medium">
                  Text {selectedStatsKind === 'kanji' ? 'kanji' : 'vocabulary'} match: {matchedActiveStatsTokens} / {totalActiveStatsTokens}
                </p>
                <p className="mt-1">
                  Difficulty: {selectedStatsPassage.difficulty} | Genre: {selectedStatsPassage.theme} | Time: ~{selectedStatsPassage.estimatedMinutes} min
                </p>
              </div>
            )}

            <div className="space-y-3">
              {levelStatsRows.map((stat) => (
                <div key={stat.level} className="rounded border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-medium text-gray-800">Level {stat.level}</span>
                    <span className="text-sm text-gray-600">
                      {stat.matched} / {stat.total}
                    </span>
                  </div>
                  <div className="h-2 rounded bg-gray-100">
                    <div
                      className="h-2 rounded bg-indigo-600"
                      style={{ width: `${stat.percentage}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-600">{stat.percentage}% matching kanji</p>
                </div>
              ))}

              {levelStats.length === 0 && (
                <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  No kanji stats available for the current filter.
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-200 pt-4">
              <span className="text-sm font-medium text-gray-700">
                Total: {matchedActiveStatsTokens} / {totalActiveStatsTokens}
              </span>
              <Pagination page={statsPage} totalPages={statsTotalPages} onPageChange={setStatsPage} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
