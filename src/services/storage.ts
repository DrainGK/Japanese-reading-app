import { WaniKaniData, ReadingSession, SessionStats, WaniKaniSubject } from '../types';

const STORAGE_KEYS = {
  WK_TOKEN: 'wk_token',
  WK_DATA: 'wk_data',
  SESSIONS: 'reading_sessions',
  CURRENT_SESSION: 'current_session',
  LAST_SESSION_DATE: 'last_session_date',
};

const DB_NAME = 'JapaneseReaderDB';
const DB_VERSION = 1;
const AUTH_CHANGE_EVENT = 'wanikani-auth-changed';
const DATA_CHANGE_EVENT = 'wanikani-data-changed';

// Initialize IndexedDB for large WaniKani data
function getIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('wk_user')) {
        db.createObjectStore('wk_user');
      }
      if (!db.objectStoreNames.contains('wk_assignments')) {
        db.createObjectStore('wk_assignments', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('wk_subjects')) {
        db.createObjectStore('wk_subjects', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('wk_reviews')) {
        db.createObjectStore('wk_reviews', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('wk_metadata')) {
        db.createObjectStore('wk_metadata');
      }
    };
  });
}

function normalizeSubject(subject: WaniKaniSubject): WaniKaniSubject {
  const subjectType = subject.type ?? subject.object;
  return {
    ...subject,
    type: subjectType,
  };
}

export class StorageService {
  private static notifyAuthChange(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
    }
  }

  private static notifyDataChange(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(DATA_CHANGE_EVENT));
    }
  }

  static subscribeToWaniKaniStateChange(callback: () => void): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    window.addEventListener(AUTH_CHANGE_EVENT, callback);
    window.addEventListener(DATA_CHANGE_EVENT, callback);
    window.addEventListener('storage', callback);

    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, callback);
      window.removeEventListener(DATA_CHANGE_EVENT, callback);
      window.removeEventListener('storage', callback);
    };
  }

  static subscribeToAuthChange(callback: () => void): () => void {
    return this.subscribeToWaniKaniStateChange(callback);
  }

  static setWaniKaniToken(token: string): void {
    localStorage.setItem(STORAGE_KEYS.WK_TOKEN, token);
    this.notifyAuthChange();
  }

  static getWaniKaniToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.WK_TOKEN);
  }

  static clearWaniKaniToken(): void {
    localStorage.removeItem(STORAGE_KEYS.WK_TOKEN);
    this.notifyAuthChange();
  }

  static async setWaniKaniData(data: WaniKaniData): Promise<void> {
    const db = await getIndexedDB();

    // Clear existing data
    const tx = db.transaction(
      ['wk_user', 'wk_assignments', 'wk_subjects', 'wk_reviews', 'wk_metadata'],
      'readwrite'
    );

    tx.objectStore('wk_user').clear();
    tx.objectStore('wk_assignments').clear();
    tx.objectStore('wk_subjects').clear();
    tx.objectStore('wk_reviews').clear();
    tx.objectStore('wk_metadata').clear();

    // Store user data
    tx.objectStore('wk_user').put(data.user, 'current');

    // Store assignments
    data.assignments.forEach((assignment) => {
      tx.objectStore('wk_assignments').put(assignment);
    });

    // Store subjects
    data.subjects.forEach((subject) => {
      tx.objectStore('wk_subjects').put(normalizeSubject(subject));
    });

    // Store reviews
    data.reviews.forEach((review) => {
      tx.objectStore('wk_reviews').put(review);
    });

    // Store metadata
    tx.objectStore('wk_metadata').put(data.fetchedAt, 'fetchedAt');

    return new Promise((resolve, reject) => {
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => {
        this.notifyDataChange();
        resolve();
      };
    });
  }

  static async getWaniKaniData(): Promise<WaniKaniData | null> {
    try {
      const db = await getIndexedDB();
      const tx = db.transaction(
        ['wk_user', 'wk_assignments', 'wk_subjects', 'wk_reviews', 'wk_metadata'],
        'readonly'
      );

      const user = await this.getFromIDB(tx.objectStore('wk_user'), 'current');
      const assignments = await this.getAllFromIDB(tx.objectStore('wk_assignments'));
      const reviews = await this.getAllFromIDB(tx.objectStore('wk_reviews'));
      const subjects = await this.getAllFromIDB(tx.objectStore('wk_subjects'));
      const fetchedAt = await this.getFromIDB(tx.objectStore('wk_metadata'), 'fetchedAt');

      if (!user) return null;

      const subjectList = ((subjects || []) as WaniKaniSubject[]).map(normalizeSubject);
      const subjectMap = new Map(subjectList.map((subject) => [subject.id, subject]));
      const kanjiSubjects = subjectList.filter((subject) => subject.type === 'kanji');
      const vocabularySubjects = subjectList.filter((subject) => subject.type === 'vocabulary');
      const kanaVocabularySubjects = subjectList.filter(
        (subject) => subject.type === 'kana_vocabulary'
      );

      return {
        user,
        assignments: assignments || [],
        reviews: reviews || [],
        subjects: subjectMap,
        fetchedAt: fetchedAt || Date.now(),
        kanjiSubjects,
        vocabularySubjects,
        kanaVocabularySubjects,
      };
    } catch {
      return null;
    }
  }

  private static getFromIDB(store: IDBObjectStore, key: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  private static getAllFromIDB(store: IDBObjectStore): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  static saveSession(session: ReadingSession): void {
    try {
      const sessions = this.getSessions();
      sessions.push(session);
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
      localStorage.setItem(STORAGE_KEYS.LAST_SESSION_DATE, session.date);
    } catch (error) {
      console.error('Failed to save session:', error);
      // If localStorage is full, try to clear old sessions
      if (error instanceof Error && error.message.includes('quota')) {
        this.clearOldSessions();
      }
    }
  }

  private static clearOldSessions(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (!stored) return;
      const sessions = JSON.parse(stored);
      // Keep only last 100 sessions
      if (sessions.length > 100) {
        const recentSessions = sessions.slice(-100);
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(recentSessions));
      }
    } catch {
      localStorage.removeItem(STORAGE_KEYS.SESSIONS);
    }
  }

  static getSessions(): ReadingSession[] {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  static getSessionStats(): SessionStats {
    const sessions = this.getSessions();
    const totalSessions = sessions.length;
    const averageScore =
      totalSessions > 0
        ? sessions.reduce((sum, s) => sum + s.score, 0) / totalSessions
        : 0;

    let currentStreak = 0;
    let checkDate = new Date();

    const sessionDates = new Set(sessions.map((s) => s.date));

    while (sessionDates.has(checkDate.toISOString().split('T')[0])) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    const lastCompletedDate =
      sessions.length > 0 ? sessions[sessions.length - 1].date : undefined;

    return {
      totalSessions,
      averageScore: Math.round(averageScore * 100) / 100,
      currentStreak,
      lastCompletedDate,
    };
  }

  static setCurrentSession(passageId: string): void {
    localStorage.setItem(
      STORAGE_KEYS.CURRENT_SESSION,
      JSON.stringify({
        passageId,
        startedAt: new Date().toISOString(),
      })
    );
  }

  static getCurrentSession(): { passageId: string; startedAt: string } | null {
    const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  static clearCurrentSession(): void {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
  }

  static getCompletedPassageIds(): Set<string> {
    const sessions = this.getSessions();
    return new Set(sessions.map((s) => s.passageId));
  }

  static hasCompletedToday(): boolean {
    const todayDate = new Date().toISOString().split('T')[0];
    const sessions = this.getSessions();
    return sessions.some((s) => s.date.split('T')[0] === todayDate);
  }

  static async clearWaniKaniData(): Promise<void> {
    try {
      const db = await getIndexedDB();
      const tx = db.transaction(
        ['wk_user', 'wk_assignments', 'wk_subjects', 'wk_reviews', 'wk_metadata'],
        'readwrite'
      );

      tx.objectStore('wk_user').clear();
      tx.objectStore('wk_assignments').clear();
      tx.objectStore('wk_subjects').clear();
      tx.objectStore('wk_reviews').clear();
      tx.objectStore('wk_metadata').clear();

      return new Promise((resolve, reject) => {
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => {
          this.notifyDataChange();
          resolve();
        };
      });
    } catch {
      // Silently fail if IndexedDB is not available
    }
  }

  static async isWaniKaniDataCached(): Promise<boolean> {
    try {
      const db = await getIndexedDB();
      const tx = db.transaction(['wk_user'], 'readonly');
      const user = await this.getFromIDB(tx.objectStore('wk_user'), 'current');
      return !!user;
    } catch {
      return false;
    }
  }
}
