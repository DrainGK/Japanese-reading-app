import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storage';
import { WaniKaniService, testWaniKaniConnection } from '../services/wanikani';

export function SetupPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userData, setUserData] = useState<any>(null);

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const normalizedToken = token.trim();

      const isValid = await testWaniKaniConnection(normalizedToken);

      if (!isValid) {
        setError('Invalid WaniKani API token. Please check and try again.');
        setLoading(false);
        return;
      }

      // Fetch user data
      const service = new WaniKaniService(normalizedToken);
      const user = await service.getUser();

      setUserData({
        level: user.level,
        username: user.username,
      });

      // Fetch and store all data
      const allData = await service.fetchAllData();
      StorageService.setWaniKaniToken(normalizedToken);
      StorageService.setWaniKaniData(allData);

      setError('');
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      setError('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">N2 Reader</h1>
          <p className="text-gray-600">Daily Japanese Reading Practice</p>
        </div>

        {/* Setup Card */}
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-6 text-gray-800">Connect WaniKani</h2>

          {userData && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-medium mb-1">✓ Connected!</p>
              <p className="text-sm text-green-700">
                Level {userData.level} • {userData.username}
              </p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleTestConnection}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
              <p className="text-xs text-gray-500 mt-2">
                Get your token at{' '}
                <a
                  href="https://wanikani.com/settings/personal_access_tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  wanikani.com/settings
                </a>
              </p>
            </div>

            <button
              type="submit"
              disabled={!token.trim() || loading || !!userData}
              className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Connecting...' : userData ? 'Connected! 🎉' : 'Connect'}
            </button>
          </form>
        </div>

        {/* Info Card */}
        <div className="card bg-indigo-50 border border-indigo-200">
          <h3 className="font-semibold text-indigo-900 mb-3">How it works:</h3>
          <ul className="text-sm text-indigo-800 space-y-2">
            <li>✓ Reads your WaniKani progress</li>
            <li>✓ Recommends reading passages based on your level</li>
            <li>✓ Tracks your reading streak and scores</li>
            <li>✓ Works completely offline after setup</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
