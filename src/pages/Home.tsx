import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storage';
import { passages } from '../data/passages';
import { buildKnowledgeModel, recommendPassage, scorePassage, getPassageScoreReason } from '../lib/recommendation';
import { WelcomeBanner } from '../components/WelcomeBanner';
import { StatsRow } from '../components/StatsRow';
import { StreakHero } from '../components/StreakHero';
import { DailyGoal } from '../components/DailyGoal';
import { isToday } from '../lib/streaks';
import { ReadingPassage } from '../types';

export function HomePage() {
  const navigate = useNavigate();
  const [todayPassage, setTodayPassage] = useState<ReadingPassage | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalSessions: 0, averageScore: 0, currentStreak: 0 });
  const [scoreReason, setScoreReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPassage = async () => {
      try {
        const token = StorageService.getWaniKaniToken();
        if (!token) {
          setLoading(false);
          return;
        }

        // Get WaniKani data
        let wkData = await StorageService.getWaniKaniData();
        if (!wkData) {
          setError('Could not load WaniKani data. Please reconnect.');
          setLoading(false);
          return;
        }

        // Build knowledge model
        const knowledge = buildKnowledgeModel(wkData);

        // Get completed passages
        const completedIds = StorageService.getCompletedPassageIds();

        // Find today's recommended passage
        const recommended = recommendPassage(passages, knowledge, completedIds);

        if (!recommended) {
          setError('No passage available right now. Please open Texts and pick one manually.');
          setTodayPassage(null);
          setScoreReason('');
        } else {
          setError('');
          setTodayPassage(recommended);

          // Get score reason
          const scored = scorePassage(recommended, knowledge, completedIds);
          if (scored) {
            setScoreReason(getPassageScoreReason(scored));
          } else {
            setScoreReason('matches your unlocked kanji and selected filters');
          }
        }

        // Get stats
        const sessionStats = StorageService.getSessionStats();
        const allSessions = StorageService.getSessions();
        setSessions(allSessions);
        setStats(sessionStats);

        setLoading(false);
      } catch (err) {
        setError('Error loading passage: ' + (err instanceof Error ? err.message : 'Unknown error'));
        setLoading(false);
      }
    };

    loadPassage();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
          <p className="mt-4 text-prose-secondary">Loading your reading...</p>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    StorageService.clearWaniKaniToken();
    await StorageService.clearWaniKaniData();
    navigate('/setup');
  };

  const hasHistory = sessions.length > 0;
  const todayDate = new Date().toISOString().split('T')[0];
  const todaySessions = sessions.filter((s) => s.date === todayDate).length;
  const dailyGoal = 1; // Can be made configurable in Sprint 4

  return (
    <div className="space-y-6">
      {/* Header with Sign Out */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-prose">N2 Reader</h1>
          <p className="text-prose-secondary text-sm">Daily Japanese reading</p>
        </div>
        <button
          onClick={handleSignOut}
          className="text-2xs text-prose-secondary hover:text-prose px-3 py-1.5 rounded hover:bg-muted transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Welcome Banner or Stats */}
      {hasHistory ? (
        <>
          <StreakHero streak={stats.currentStreak} hasReadToday={todaySessions > 0} />
          <StatsRow
            streak={stats.currentStreak}
            sessions={stats.totalSessions}
            avgScore={stats.averageScore}
            hasReadToday={todaySessions > 0}
          />
          <DailyGoal dailyGoal={dailyGoal} todaySessions={todaySessions} />
        </>
      ) : (
        <WelcomeBanner />
      )}

      {/* Today's Passage */}
      {todayPassage ? (
        <div className="card space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="badge badge-primary">{todayPassage.theme}</span>
            </div>
            <h2 className="text-xl font-semibold text-prose mb-2">{todayPassage.title}</h2>
            <p className="text-prose-secondary text-sm mb-4">{todayPassage.summary}</p>

            <div className="flex flex-wrap gap-2 mb-4 text-xs">
              <div className="px-2.5 py-1 rounded bg-muted text-prose-secondary">
                Difficulty: {todayPassage.difficulty}
              </div>
              <div className="px-2.5 py-1 rounded bg-muted text-prose-secondary">
                ~{todayPassage.estimatedMinutes} min
              </div>
              <div className="px-2.5 py-1 rounded bg-muted text-prose-secondary">
                {todayPassage.source ?? 'Local'}
              </div>
            </div>

            {scoreReason && (
              <div className="p-3 rounded-lg bg-primary-50 border border-primary-100">
                <p className="text-xs text-primary-700">
                  <span className="font-medium">Recommended:</span> {scoreReason}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => navigate(`/reading/${todayPassage.id}`)}
            className="btn btn-primary w-full"
          >
            Start Reading →
          </button>
        </div>
      ) : error ? (
        <div className="card bg-warning-50 border border-warning-100">
          <p className="text-warning-700 text-center py-4 text-sm">{error}</p>
          {error.includes('reconnect') && (
            <button
              onClick={handleSignOut}
              className="mt-4 w-full px-4 py-2 bg-warning-500 text-prose-inverse rounded-lg hover:bg-warning-600 transition-colors text-sm font-medium"
            >
              Reconnect to WaniKani
            </button>
          )}
        </div>
      ) : null}

      {/* Navigation Buttons */}
      <div className="flex gap-3">
        <button onClick={() => navigate('/texts')} className="btn btn-primary flex-1">
          Browse Texts →
        </button>
        <button onClick={() => navigate('/history')} className="btn btn-secondary flex-1">
          History
        </button>
      </div>
    </div>
  );
}
