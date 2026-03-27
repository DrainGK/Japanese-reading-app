import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storage';
import { ReadingSession } from '../types';
import { formatDate, calculateScorePercentage, formatTime } from '../lib/utils';

export function HistoryPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [stats, setStats] = useState({ totalSessions: 0, averageScore: 0, currentStreak: 0 });

  useEffect(() => {
    const allSessions = StorageService.getSessions();
    setSessions(allSessions);

    const sessionStats = StorageService.getSessionStats();
    setStats(sessionStats);
  }, []);

  const groupedByDate = sessions.reduce((acc, session) => {
    const date = session.date.split('T')[0];
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(session);
    return acc;
  }, {} as Record<string, ReadingSession[]>);

  const sortedDates = Object.keys(groupedByDate).sort().reverse();

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/')}
          className="text-indigo-600 hover:text-indigo-700 font-medium"
        >
          ← Back
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-800">History</h1>
          <p className="text-gray-600">Your reading practice sessions</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="text-3xl font-bold text-indigo-600">{stats.currentStreak}</div>
          <p className="text-gray-600 text-sm">Day Streak 🔥</p>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-green-600">{stats.totalSessions}</div>
          <p className="text-gray-600 text-sm">Total Sessions</p>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-blue-600">{stats.averageScore.toFixed(1)}%</div>
          <p className="text-gray-600 text-sm">Average Score</p>
        </div>
      </div>

      {/* Sessions List */}
      {sortedDates.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600 mb-4">No sessions yet!</p>
          <button
            onClick={() => navigate('/')}
            className="btn btn-primary"
          >
            Start Your First Reading →
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <div className="sticky top-0 bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-3 rounded-lg mb-3 font-semibold text-gray-700">
                {formatDate(date)}
              </div>

              <div className="space-y-3">
                {groupedByDate[date].map((session) => {
                  const scorePercentage = calculateScorePercentage(
                    session.score,
                    session.totalQuestions
                  );
                  const scoreColor =
                    scorePercentage >= 80
                      ? 'text-green-600'
                      : scorePercentage >= 60
                      ? 'text-blue-600'
                      : 'text-amber-600';

                  return (
                    <div
                      key={session.id}
                      className="card hover:shadow-lg cursor-pointer transition-shadow"
                    >
                      <div className="flex items-start justify-between flex-wrap gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800 mb-1">
                            {session.passageTitle}
                          </h3>

                          <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-2">
                            <span className="capitalize px-2 py-1 rounded bg-gray-100">
                              {session.theme}
                            </span>
                            <span className="capitalize px-2 py-1 rounded bg-gray-100">
                              {session.difficulty}
                            </span>
                            {session.timeSpentSeconds && (
                              <span className="px-2 py-1 rounded bg-gray-100">
                                {formatTime(session.timeSpentSeconds)}
                              </span>
                            )}
                          </div>

                          {session.feedback && (
                            <div className="text-xs text-gray-500">
                              Feedback:{' '}
                              <span className="capitalize">
                                {session.feedback === 'easy'
                                  ? '😌 Too easy'
                                  : session.feedback === 'perfect'
                                  ? '👍 Just right'
                                  : '💪 Challenging'}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <div className={`text-2xl font-bold ${scoreColor}`}>
                            {scorePercentage}%
                          </div>
                          <p className="text-xs text-gray-600">
                            {session.score}/{session.totalQuestions}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer Actions */}
      <div className="mt-12 pt-8 border-t text-center">
        <button
          onClick={() => navigate('/')}
          className="btn btn-primary"
        >
          Start New Session →
        </button>
      </div>
    </div>
  );
}
