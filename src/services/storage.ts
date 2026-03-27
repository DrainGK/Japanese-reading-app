import { WaniKaniData, ReadingSession, SessionStats } from '../types';

const STORAGE_KEYS = {
  WK_TOKEN: 'wk_token',
  WK_DATA: 'wk_data',
  SESSIONS: 'reading_sessions',
  CURRENT_SESSION: 'current_session',
  LAST_SESSION_DATE: 'last_session_date',
};

export class StorageService {
  static setWaniKaniToken(token: string): void {
    localStorage.setItem(STORAGE_KEYS.WK_TOKEN, token);
  }

  static getWaniKaniToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.WK_TOKEN);
  }

  static clearWaniKaniToken(): void {
    localStorage.removeItem(STORAGE_KEYS.WK_TOKEN);
  }

  static setWaniKaniData(data: WaniKaniData): void {
    const serializable = {
      user: data.user,
      assignments: data.assignments,
      reviews: data.reviews,
      subjects: Array.from(data.subjects.entries()),
      fetchedAt: data.fetchedAt,
    };
    localStorage.setItem(STORAGE_KEYS.WK_DATA, JSON.stringify(serializable));
  }

  static getWaniKaniData(): WaniKaniData | null {
    const stored = localStorage.getItem(STORAGE_KEYS.WK_DATA);
    if (!stored) return null;

    try {
      const parsed = JSON.parse(stored);
      return {
        user: parsed.user,
        assignments: parsed.assignments,
        reviews: parsed.reviews,
        subjects: new Map(parsed.subjects),
        fetchedAt: parsed.fetchedAt,
      };
    } catch {
      return null;
    }
  }

  static saveSession(session: ReadingSession): void {
    const sessions = this.getSessions();
    sessions.push(session);
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    localStorage.setItem(STORAGE_KEYS.LAST_SESSION_DATE, session.date);
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
}
