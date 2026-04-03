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

// Layout wrapper for pages with navbar
function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
      {children}
    </div>
  );
}

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
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
          <p className="mt-4 text-prose-secondary">Loading N2 Reader...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-base">
        {isSetup && <NavBar />}
        <Routes>
          {isSetup ? (
            <>
              <Route path="/" element={<PageLayout><HomePage /></PageLayout>} />
              <Route path="/texts" element={<PageLayout><TextsPage /></PageLayout>} />
              <Route path="/kanji" element={<PageLayout><KanjiPage /></PageLayout>} />
              <Route path="/vocabulary" element={<PageLayout><VocabularyPage /></PageLayout>} />
              <Route path="/user" element={<PageLayout><UserPage /></PageLayout>} />
              <Route path="/reading/:id" element={<PageLayout><ReadingPage /></PageLayout>} />
              <Route path="/questions/:id" element={<PageLayout><QuestionsPage /></PageLayout>} />
              <Route path="/results/:id" element={<PageLayout><ResultsPage /></PageLayout>} />
              <Route path="/history" element={<PageLayout><HistoryPage /></PageLayout>} />
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
