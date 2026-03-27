import { KnowledgeModel, WaniKaniData, ReadingPassage } from '../types';

const KANJI_CHAR_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF々]/g;

function extractKanjiChars(text: string): string[] {
  return Array.from(new Set(text.match(KANJI_CHAR_REGEX) ?? []));
}

function getPassageSource(passage: ReadingPassage): 'local' | 'aozora' {
  return passage.source ?? 'local';
}

export function buildKnowledgeModel(waniKaniData: WaniKaniData): KnowledgeModel {
  const unlockedKanji = new Set<string>();
  const knownKanji = new Set<string>();
  const knownVocab = new Set<string>();
  const weakItems = new Set<string>();
  const recentItems = new Set<string>();

  const now = Date.now();
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Process assignments to categorize items
  waniKaniData.assignments.forEach((assignment) => {
    const subjectId = assignment.data.subject_id;
    const subject = waniKaniData.subjects.get(subjectId);

    if (!subject) return;

    const characters = subject.data.characters;
    if (!characters) return;

    const srsStage = assignment.data.srs_stage;
    const unlockedAt = assignment.data.unlocked_at
      ? new Date(assignment.data.unlocked_at).getTime()
      : 0;
    const startedAt = assignment.data.started_at
      ? new Date(assignment.data.started_at).getTime()
      : 0;

    // Categorize based on SRS stage
    if (subject.type === 'kanji' && assignment.data.unlocked_at) {
      unlockedKanji.add(characters);
    }

    if (srsStage >= 5) {
      // Guru and above = known
      if (subject.type === 'kanji') {
        knownKanji.add(characters);
      } else if (subject.type === 'vocabulary') {
        knownVocab.add(characters);
      }
    }

    // Recent items (unlocked within 1 month)
    if (unlockedAt > oneMonthAgo) {
      recentItems.add(characters);
    }

    // Weak items (low SRS stage, meaning items user is struggling with)
    if (srsStage >= 1 && srsStage <= 3 && startedAt > oneWeekAgo) {
      weakItems.add(characters);
    }
  });

  // Also consider review accuracy for weak items
  const reviewAccuracy = new Map<number, { correct: number; total: number }>();
  waniKaniData.reviews.forEach((review) => {
    const subjectId = review.data.subject_id;
    const current = reviewAccuracy.get(subjectId) || { correct: 0, total: 0 };
    current.total++;
    if (review.data.correct) {
      current.correct++;
    }
    reviewAccuracy.set(subjectId, current);
  });

  // Add items with low accuracy to weak items
  reviewAccuracy.forEach((accuracy, subjectId) => {
    if (accuracy.total >= 3) {
      const correctRate = accuracy.correct / accuracy.total;
      if (correctRate < 0.5) {
        const subject = waniKaniData.subjects.get(subjectId);
        if (subject?.data.characters) {
          weakItems.add(subject.data.characters);
        }
      }
    }
  });

  return {
    level: waniKaniData.user?.level || 1,
    unlockedKanji,
    knownKanji,
    knownVocab,
    weakItems,
    recentItems,
  };
}

export interface RecommendationFilters {
  theme?: ReadingPassage['theme'] | 'all';
  source?: 'local' | 'aozora' | 'all';
  requireUnlockedMatch?: boolean;
}

export interface PassageScore {
  passage: ReadingPassage;
  score: number;
  breakdown: {
    coverage: number;
    reviewBonus: number;
    recentBonus: number;
    difficultyMultiplier: number;
  };
}

export function scorePassage(
  passage: ReadingPassage,
  knowledge: KnowledgeModel,
  completedIds: Set<string>
): PassageScore | null {
  // Don't recommend already completed passages
  if (completedIds.has(passage.id)) {
    return null;
  }

  // Count overlaps
  const allKanji = new Set([...passage.kanjiList]);
  const allVocab = new Set([...passage.vocabList]);
  const totalItems = allKanji.size + allVocab.size;

  if (totalItems === 0) {
    return null;
  }

  let knownCount = 0;
  let unknownCount = 0;
  let weakCount = 0;
  let recentCount = 0;

  allKanji.forEach((kanji) => {
    if (knowledge.knownKanji.has(kanji)) {
      knownCount++;
    } else if (knowledge.weakItems.has(kanji)) {
      weakCount++;
    } else if (knowledge.recentItems.has(kanji)) {
      recentCount++;
    } else {
      unknownCount++;
    }
  });

  allVocab.forEach((vocab) => {
    if (knowledge.knownVocab.has(vocab)) {
      knownCount++;
    } else if (knowledge.weakItems.has(vocab)) {
      weakCount++;
    } else if (knowledge.recentItems.has(vocab)) {
      recentCount++;
    } else {
      unknownCount++;
    }
  });

  // Penalty if too many unknown items (> 20%)
  if (unknownCount / totalItems > 0.2) {
    return null;
  }

  // Calculate coverage
  const coverage = (knownCount / totalItems) * 100;

  // Bonuses
  const reviewBonus = (weakCount / totalItems) * 50; // Reward reviewing weak items
  const recentBonus = (recentCount / totalItems) * 30; // Reward practicing recent items

  // Difficulty multiplier (prefer passages slightly above current level)
  const difficultyScores: { [key in typeof passage.difficulty]: number } = {
    easy: 0.8,
    normal: 1.0,
    hard: 0.6,
  };
  const difficultyMultiplier = difficultyScores[passage.difficulty];

  // Final score calculation
  const score =
    (coverage + reviewBonus + recentBonus) * difficultyMultiplier * 0.01;

  return {
    passage,
    score,
    breakdown: {
      coverage: Math.round(coverage),
      reviewBonus: Math.round(reviewBonus),
      recentBonus: Math.round(recentBonus),
      difficultyMultiplier,
    },
  };
}

export function recommendPassage(
  passages: ReadingPassage[],
  knowledge: KnowledgeModel,
  completedIds: Set<string>,
  filters?: RecommendationFilters
): ReadingPassage | null {
  const baseFiltered = passages.filter((passage) => {
    if (filters?.theme && filters.theme !== 'all' && passage.theme !== filters.theme) {
      return false;
    }

    if (filters?.source && filters.source !== 'all' && getPassageSource(passage) !== filters.source) {
      return false;
    }

    if (!filters?.requireUnlockedMatch) {
      return true;
    }

    if (knowledge.unlockedKanji.size === 0) {
      return true;
    }

    const passageKanji = extractKanjiChars(passage.text);
    if (passageKanji.length === 0) {
      return true;
    }

    const unlockedOverlap = passageKanji.filter((k) => knowledge.unlockedKanji.has(k)).length;
    return unlockedOverlap > 0;
  });

  const incompleteAndMatched = baseFiltered.filter((passage) => !completedIds.has(passage.id));
  const candidatePool = incompleteAndMatched.length > 0 ? incompleteAndMatched : baseFiltered;

  if (candidatePool.length === 0) {
    // Final fallback: honor only metadata filters and ignore unlocked-kanji restriction.
    const metadataOnly = passages.filter((passage) => {
      if (filters?.theme && filters.theme !== 'all' && passage.theme !== filters.theme) {
        return false;
      }

      if (filters?.source && filters.source !== 'all' && getPassageSource(passage) !== filters.source) {
        return false;
      }

      return true;
    });

    const incompleteMetadataOnly = metadataOnly.filter((passage) => !completedIds.has(passage.id));
    const metadataPool = incompleteMetadataOnly.length > 0 ? incompleteMetadataOnly : metadataOnly;
    return metadataPool[0] ?? null;
  }

  const scores = candidatePool
    .map((p) => scorePassage(p, knowledge, completedIds))
    .filter((s): s is PassageScore => s !== null)
    .sort((a, b) => b.score - a.score);

  if (scores.length > 0) {
    return scores[0].passage;
  }

  // Fallback: return first candidate even when strict score threshold rejects all.
  return candidatePool[0] ?? null;
}

export function getPassageScoreReason(score: PassageScore): string {
  const { coverage, reviewBonus, recentBonus } = score.breakdown;

  const reasons: string[] = [];

  if (coverage > 80) {
    reasons.push('matches your level well');
  } else if (coverage < 60) {
    reasons.push('good challenge');
  }

  if (reviewBonus > 0) {
    reasons.push('includes weak items to review');
  }

  if (recentBonus > 0) {
    reasons.push('reinforces recent learning');
  }

  return reasons.join(', ') || 'recommended for you';
}
