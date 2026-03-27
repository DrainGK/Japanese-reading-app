import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { StorageService } from './services/storage';
import { SetupPage } from './pages/Setup';
import { HomePage } from './pages/Home';
import { ReadingPage } from './pages/Reading';
import { QuestionsPage } from './pages/Questions';
import { ResultsPage } from './pages/Results';
import { HistoryPage } from './pages/History';
import './index.css';

function App() {
  const [isSetup, setIsSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if WaniKani token exists
    const token = StorageService.getWaniKaniToken();
    setIsSetup(!!token);
    setLoading(false);
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
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {isSetup ? (
            <>
              <Route path="/" element={<HomePage />} />
              <Route path="/reading/:id" element={<ReadingPage />} />
              <Route path="/questions/:id" element={<QuestionsPage />} />
              <Route path="/results/:id" element={<ResultsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/setup" element={<SetupPage />} />
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
