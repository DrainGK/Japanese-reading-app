// WaniKani API types
export interface WaniKaniUser {
  id: number;
  level: number;
  username: string;
  max_level_granted_by_subscription?: number;
}

export interface WaniKaniAssignment {
  id: number;
  data: {
    created_at: string;
    srs_stage: number;
    subject_id: number;
    started_at: string | null;
    passed_at: string | null;
    unlocked_at: string | null;
    available_at: string | null;
  };
}

export interface WaniKaniSubject {
  id: number;
  type: 'radical' | 'kanji' | 'vocabulary';
  object: string;
  data: {
    slug: string;
    characters: string | null;
    meanings: Array<{ meaning: string }>;
    readings?: Array<{ reading: string }>;
  };
}

export interface WaniKaniReview {
  id: number;
  data: {
    created_at: string;
    subject_id: number;
    starting_srs_stage: number;
    ending_srs_stage: number;
    correct: boolean;
  };
}

// Knowledge model
export interface KnowledgeModel {
  level: number;
  knownKanji: Set<string>;
  knownVocab: Set<string>;
  weakItems: Set<string>;
  recentItems: Set<string>;
}

// Reading passage types
export interface ReadingPassage {
  id: string;
  title: string;
  summary: string;
  theme: 'daily-life' | 'society' | 'work' | 'culture' | 'history' | 'opinion';
  difficulty: 'easy' | 'normal' | 'hard';
  text: string;
  estimatedMinutes: number;
  kanjiList: string[];
  vocabList: string[];
  questions: Question[];
}

export interface Question {
  id: string;
  prompt: string;
  choices: string[];
  correctAnswerIndex: number;
  explanation: string;
  type: 'main-idea' | 'detail' | 'inference' | 'intention';
}

// Session types
export interface ReadingSession {
  id: string;
  passageId: string;
  passageTitle: string;
  date: string;
  score: number;
  totalQuestions: number;
  timeSpentSeconds?: number;
  difficulty: string;
  theme: string;
  feedback?: 'easy' | 'perfect' | 'difficult';
  answers: number[];
}

export interface SessionStats {
  totalSessions: number;
  averageScore: number;
  currentStreak: number;
  lastCompletedDate?: string;
}

export interface WaniKaniData {
  user: WaniKaniUser | null;
  assignments: WaniKaniAssignment[];
  subjects: Map<number, WaniKaniSubject>;
  reviews: WaniKaniReview[];
  fetchedAt: number;
}
