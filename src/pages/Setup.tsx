import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storage';
import { syncWaniKaniData } from '../services/wanikani';

export function SetupPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const syncInProgressRef = useRef(false);

  const runSync = async (rawToken: string) => {
    const normalizedToken = rawToken.trim();
    if (!normalizedToken || syncInProgressRef.current) return;

    syncInProgressRef.current = true;
    setLoading(true);
    setError('');

    console.log('connect/sync start');

    try {
      StorageService.setWaniKaniToken(normalizedToken);

      const allData = await syncWaniKaniData(normalizedToken);
      await StorageService.setWaniKaniData(allData);

      setUserData({
        level: allData.user?.level,
        username: allData.user?.username,
      });

      setError('');
      navigate('/', { replace: true });
    } catch (err) {
      StorageService.clearWaniKaniToken();
      await StorageService.clearWaniKaniData();

      setError('Error ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
      syncInProgressRef.current = false;
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      const existingToken = StorageService.getWaniKaniToken();
      if (!existingToken) return;

      const isCached = await StorageService.isWaniKaniDataCached();
      if (isCached) {
        navigate('/', { replace: true });
        return;
      }

      setToken(existingToken);
      await runSync(existingToken);
    };

    void bootstrap();
  }, [navigate]);

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || syncInProgressRef.current) return;
    await runSync(token);
  };


  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-prose mb-2">N2 Reader</h1>
          <p className="text-prose-secondary text-sm">Learn Japanese with your WaniKani level</p>
        </div>

        {/* Steps/How it Works - BEFORE the form */}
        <div className="space-y-3 mb-8">
          <div className="card space-y-2">
            <div className="flex gap-3">
              <span className="text-2xl">📊</span>
              <div>
                <p className="text-sm font-medium text-prose">Reads your WaniKani progress</p>
              </div>
            </div>
          </div>
          
          <div className="card space-y-2">
            <div className="flex gap-3">
              <span className="text-2xl">📖</span>
              <div>
                <p className="text-sm font-medium text-prose">Recommends texts at your exact level</p>
              </div>
            </div>
          </div>

          <div className="card space-y-2">
            <div className="flex gap-3">
              <span className="text-2xl">🔥</span>
              <div>
                <p className="text-sm font-medium text-prose">Tracks your daily reading streak</p>
              </div>
            </div>
          </div>

          <div className="card space-y-2">
            <div className="flex gap-3">
              <span className="text-2xl">📡</span>
              <div>
                <p className="text-sm font-medium text-prose">Works completely offline</p>
              </div>
            </div>
          </div>
        </div>

        {/* Setup Form Card */}
        <div className="card">
          <h2 className="text-lg font-semibold text-prose mb-4">Connect WaniKani</h2>

          {userData && (
            <div className="mb-4 p-3 bg-success-50 border border-success-100 rounded-lg animate-fade-up">
              <p className="text-success-600 font-medium text-sm mb-1">✓ Connected!</p>
              <p className="text-xs text-success-600">
                Level {userData.level} • {userData.username}
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-100 rounded-lg">
              <p className="text-danger-600 text-xs">{error}</p>
            </div>
          )}

          <form onSubmit={handleTestConnection}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-prose mb-2">
                WaniKani API Token
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your API token here"
                className="input-field"
                disabled={loading || !!userData}
              />
              <p className="text-xs text-prose-muted mt-2">
                Get your token at{' '}
                <a
                  href="https://wanikani.com/settings/personal_access_tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-400 hover:underline font-medium"
                >
                  wanikani.com/settings
                </a>
              </p>
            </div>

            <button
              type="submit"
              disabled={!token.trim() || loading || !!userData}
              className="btn btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Connecting...' : userData ? 'Connected! 🎉' : 'Connect to WaniKani'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
