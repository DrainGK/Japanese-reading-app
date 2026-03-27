import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storage';
import { WaniKaniService } from '../services/wanikani';
import { passages } from '../data/passages';
import { buildKnowledgeModel, recommendPassage, scorePassage, getPassageScoreReason } from '../lib/recommendation';
import { ReadingPassage } from '../types';

export function HomePage() {
  const navigate = useNavigate();
  const [todayPassage, setTodayPassage] = useState<ReadingPassage | null>(null);
  const [stats, setStats] = useState({ totalSessions: 0, averageScore: 0, currentStreak: 0 });
  const [scoreReason, setScoreReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPassage = async () => {
      try {
        const token = StorageService.getWaniKaniToken();
        if (!token) {
          navigate('/setup');
          return;
        }

        // Get WaniKani data
        let wkData = StorageService.getWaniKaniData();
        if (!wkData) {
          // Fetch if not cached
          const service = new WaniKaniService(token);
          wkData = await service.fetchAllData();
          StorageService.setWaniKaniData(wkData);
        }

        // Build knowledge model
        const knowledge = buildKnowledgeModel(wkData);

        // Get completed passages
        const completedIds = StorageService.getCompletedPassageIds();

        // Find today's recommended passage
        const recommended = recommendPassage(passages, knowledge, completedIds);

        if (!recommended) {
          setError('All passages completed!');
          setTodayPassage(null);
        } else {
          setTodayPassage(recommended);

          // Get score reason
          const scored = scorePassage(recommended, knowledge, completedIds);
          if (scored) {
            setScoreReason(getPassageScoreReason(scored));
          }
        }

        // Get stats
        const sessionStats = StorageService.getSessionStats();
        setStats(sessionStats);

        setLoading(false);
      } catch (err) {
        setError('Error loading passage: ' + (err instanceof Error ? err.message : 'Unknown error'));
        setLoading(false);
      }
    };

    loadPassage();
  }, [navigate]);

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto py-12 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading your reading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">N2 Reader</h1>
        <p className="text-gray-600">Today's Reading Practice</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="text-3xl font-bold text-indigo-600">{stats.currentStreak}</div>
          <p className="text-gray-600 text-sm">Day Streak 🔥</p>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-green-600">{stats.totalSessions}</div>
          <p className="text-gray-600 text-sm">Sessions</p>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-blue-600">{stats.averageScore.toFixed(1)}%</div>
          <p className="text-gray-600 text-sm">Average Score</p>
        </div>
      </div>

      {/* Today's Passage */}
      {todayPassage ? (
        <div className="card mb-8">
          <div className="mb-6">
            <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-700 mb-3">
              {todayPassage.theme}
            </span>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{todayPassage.title}</h2>
            <p className="text-gray-600 mb-4">{todayPassage.summary}</p>

            <div className="flex flex-wrap gap-4 mb-6 text-sm">
              <div className="flex items-center text-gray-700">
                <span className="font-medium mr-2">Difficulty:</span>
                <span className="capitalize px-3 py-1 rounded bg-gray-100">
                  {todayPassage.difficulty}
                </span>
              </div>
              <div className="flex items-center text-gray-700">
                <span className="font-medium mr-2">Time:</span>
                <span className="px-3 py-1 rounded bg-gray-100">
                  ~{todayPassage.estimatedMinutes} min
                </span>
              </div>
            </div>

            {scoreReason && (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 mb-6">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Recommended because:</span> {scoreReason}
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
        <div className="card bg-amber-50 border border-amber-200">
          <p className="text-amber-800 text-center py-8">{error}</p>
        </div>
      ) : null}

      {/* Navigation to History */}
      <div className="text-center mt-8">
        <button
          onClick={() => navigate('/history')}
          className="btn btn-secondary"
        >
          View History →
        </button>
      </div>
    </div>
  );
}
