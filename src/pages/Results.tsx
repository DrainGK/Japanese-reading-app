import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { passages } from '../data/passages';
import { useSession } from '../hooks/useSession';
import { calculateScorePercentage, getScoreFeedback, formatTime } from '../lib/utils';

export function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, saveSession, resetSession } = useSession();
  const [feedback, setFeedback] = useState<'easy' | 'perfect' | 'difficult' | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const passage = passages.find((p) => p.id === id);

  if (!passage || !session.passage || session.passage.id !== passage.id) {
    return (
      <div className="text-center py-12">
        <p>Results not found. Redirecting...</p>
      </div>
    );
  }

  const correctAnswers = session.answers.reduce((count, answerIdx, qIdx) => {
    return count + (answerIdx === passage.questions[qIdx].correctAnswerIndex ? 1 : 0);
  }, 0);

  const scorePercentage = calculateScorePercentage(correctAnswers, passage.questions.length);
  const feedbackMessage = getScoreFeedback(scorePercentage);
  const timeSpent = session.timeStarted
    ? Math.floor((Date.now() - session.timeStarted) / 1000)
    : undefined;

  const handleSubmit = () => {
    saveSession(feedback || 'perfect');
    setSubmitted(true);

    setTimeout(() => {
      resetSession();
      navigate('/');
    }, 2000);
  };

  if (submitted) {
    return (
      <div className="container max-w-4xl mx-auto py-6 px-4 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Session saved!</h1>
          <p className="text-gray-600">Redirecting to home...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Results</h1>
        <p className="text-gray-600">Your answers have been recorded</p>
      </div>

      {/* Score Card */}
      <div className="card mb-8 text-center">
        <div className="mb-6">
          <div className="text-6xl font-bold text-indigo-600 mb-2">{scorePercentage}%</div>
          <div className="text-2xl font-semibold text-gray-800">{feedbackMessage}</div>
        </div>

        {/* Score Breakdown */}
        <div className="border-t pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-3xl font-bold text-green-600">{correctAnswers}</p>
              <p className="text-gray-600 text-sm">Correct</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-red-600">
                {passage.questions.length - correctAnswers}
              </p>
              <p className="text-gray-600 text-sm">Incorrect</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        {timeSpent && (
          <div className="border-t mt-6 pt-6">
            <p className="text-gray-700">
              <span className="font-medium">Reading time:</span>{' '}
              {formatTime(timeSpent)}
            </p>
          </div>
        )}
      </div>

      {/* Answer Review */}
      <div className="card mb-8">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Answer Review</h2>

        <div className="space-y-6">
          {passage.questions.map((question, idx) => {
            const isCorrect = session.answers[idx] === question.correctAnswerIndex;
            return (
              <div
                key={question.id}
                className={`p-4 rounded-lg border-l-4 ${
                  isCorrect
                    ? 'bg-green-50 border-green-500'
                    : 'bg-red-50 border-red-500'
                }`}
              >
                <div className="flex items-start gap-3 mb-2">
                  <span className="text-xl mt-1">
                    {isCorrect ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{question.prompt}</p>
                    <p className="text-sm text-gray-700 mt-1">
                      Your answer:{' '}
                      <span className="font-medium">
                        {question.choices[session.answers[idx]]}
                      </span>
                    </p>
                    {!isCorrect && (
                      <p className="text-sm text-gray-700 mt-1">
                        Correct answer:{' '}
                        <span className="font-medium text-green-700">
                          {question.choices[question.correctAnswerIndex]}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feedback Section */}
      <div className="card mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4">How was this session?</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setFeedback('easy')}
            className={`flex-1 py-3 rounded-lg font-medium transition-all ${
              feedback === 'easy'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            😌 Too Easy
          </button>
          <button
            onClick={() => setFeedback('perfect')}
            className={`flex-1 py-3 rounded-lg font-medium transition-all ${
              feedback === 'perfect'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            👍 Just Right
          </button>
          <button
            onClick={() => setFeedback('difficult')}
            className={`flex-1 py-3 rounded-lg font-medium transition-all ${
              feedback === 'difficult'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            💪 Challenging
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        className="btn btn-primary w-full mb-4"
      >
        Save and Return Home →
      </button>
    </div>
  );
}
