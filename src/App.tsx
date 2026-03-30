import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { StorageService } from './services/storage';
import { NavBar } from './components/NavBar';
import { SetupPage } from './pages/Setup';
import { HomePage } from './pages/Home';
import { TextsPage } from './pages/Texts';
import { KanjiPage } from './pages/Kanji';
import { VocabularyPage } from './pages/Vocabulary';
import { UserPage } from './pages/User';
import { ReadingPage } from './pages/Reading';
import { QuestionsPage } from './pages/Questions';
import { ResultsPage } from './pages/Results';
import { HistoryPage } from './pages/History';
import './index.css';

function App() {
  const [loading, setLoading] = useState(true);
  const [isSetup, setIsSetup] = useState(false);

  useEffect(() => {
    let mounted = true;

    const refreshSetupState = async () => {
      const hasToken = !!StorageService.getWaniKaniToken();
      const hasCachedData = hasToken ? await StorageService.isWaniKaniDataCached() : false;

      if (!mounted) return;
      setIsSetup(hasToken && hasCachedData);
      setLoading(false);
    };

    void refreshSetupState();

    const unsubscribe = StorageService.subscribeToWaniKaniStateChange(() => {
      void refreshSetupState();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading N2 Reader...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className={`min-h-screen bg-gray-50 ${isSetup ? 'pb-20 md:pb-0' : ''}`}>
        {isSetup && <NavBar />}
        <Routes>
          {isSetup ? (
            <>
              <Route path="/" element={<HomePage />} />
              <Route path="/texts" element={<TextsPage />} />
              <Route path="/kanji" element={<KanjiPage />} />
              <Route path="/vocabulary" element={<VocabularyPage />} />
              <Route path="/user" element={<UserPage />} />
              <Route path="/reading/:id" element={<ReadingPage />} />
              <Route path="/questions/:id" element={<QuestionsPage />} />
              <Route path="/results/:id" element={<ResultsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/setup" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          ) : (
            <>
              <Route path="/setup" element={<SetupPage />} />
              <Route path="*" element={<Navigate to="/setup" />} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
