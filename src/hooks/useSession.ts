import { useState, useCallback, useEffect } from 'react';
import { ReadingSession, ReadingPassage } from '../types';
import { StorageService } from '../services/storage';
import { generateSessionId } from '../lib/utils';

const ACTIVE_SESSION_STORAGE_KEY = 'active_reading_session_state';

function loadPersistedSession(): SessionState {
  try {
    const stored = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!stored) return initialState;
    return { ...initialState, ...JSON.parse(stored) };
  } catch {
    return initialState;
  }
}

function persistSession(session: SessionState): void {
  try {
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage write failures for transient session state.
  }
}

export interface SessionState {
  passageId: string | null;
  passage: ReadingPassage | null;
  currentQuestionIndex: number;
  answers: number[];
  timeStarted: number | null;
  timeElapsed: number;
  isTimerRunning: boolean;
}

const initialState: SessionState = {
  passageId: null,
  passage: null,
  currentQuestionIndex: 0,
  answers: [],
  timeStarted: null,
  timeElapsed: 0,
  isTimerRunning: false,
};

export function useSession() {
  const [session, setSession] = useState<SessionState>(() => loadPersistedSession());
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    setSessionId(generateSessionId());
  }, []);

  useEffect(() => {
    persistSession(session);
  }, [session]);

  const startSession = useCallback((passage: ReadingPassage) => {
    setSession({
      ...initialState,
      passage,
      passageId: passage.id,
      timeStarted: Date.now(),
    });
    StorageService.setCurrentSession(passage.id);
  }, []);

  const startTimer = useCallback(() => {
    if (!session.timeStarted && !session.isTimerRunning) {
      setSession((prev) => ({
        ...prev,
        timeStarted: Date.now(),
        isTimerRunning: true,
      }));
    } else {
      setSession((prev) => ({ ...prev, isTimerRunning: !prev.isTimerRunning }));
    }
  }, [session.timeStarted, session.isTimerRunning]);

  const answerQuestion = useCallback((answerIndex: number) => {
    setSession((prev) => ({
      ...prev,
      answers: [...prev.answers, answerIndex],
    }));
  }, []);

  const nextQuestion = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      currentQuestionIndex: prev.currentQuestionIndex + 1,
    }));
  }, []);

  const previousQuestion = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      currentQuestionIndex: Math.max(prev.currentQuestionIndex - 1, 0),
    }));
  }, []);

  const saveSession = useCallback(
    (feedback?: 'easy' | 'perfect' | 'difficult') => {
      if (!session.passage || !sessionId) return;

      const correctAnswers = session.answers.reduce((count, answerIdx, qIdx) => {
        return count + (answerIdx === session.passage!.questions[qIdx].correctAnswerIndex ? 1 : 0);
      }, 0);

      const timeSpent = session.timeStarted
        ? Math.round((Date.now() - session.timeStarted) / 1000)
        : undefined;

      const readingSession: ReadingSession = {
        id: sessionId,
        passageId: session.passage.id,
        passageTitle: session.passage.title,
        date: new Date().toISOString(),
        score: correctAnswers,
        totalQuestions: session.passage.questions.length,
        timeSpentSeconds: timeSpent,
        difficulty: session.passage.difficulty,
        theme: session.passage.theme,
        feedback,
        answers: session.answers,
      };

      StorageService.saveSession(readingSession);
      StorageService.clearCurrentSession();

      return readingSession;
    },
    [session, sessionId]
  );

  const resetSession = useCallback(() => {
    setSession(initialState);
    StorageService.clearCurrentSession();
    localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    setSessionId(generateSessionId());
  }, []);

  return {
    session,
    sessionId,
    startSession,
    startTimer,
    answerQuestion,
    nextQuestion,
    previousQuestion,
    saveSession,
    resetSession,
  };
}
