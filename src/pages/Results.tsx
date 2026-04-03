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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-xl font-semibold text-prose mb-2">Session saved!</h1>
          <p className="text-prose-secondary text-sm">Redirecting to home...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-prose mb-1">Results</h1>
        <p className="text-prose-secondary text-sm">Your answers have been recorded</p>
      </div>

      {/* Score Hero - Animated */}
      <div className="card text-center py-8">
        <div className="animate-pop mb-4">
          <div className="text-6xl font-semibold text-primary-400 mb-2">{scorePercentage}%</div>
          <div className="text-lg font-medium text-prose">{feedbackMessage}</div>
        </div>
      </div>

      {/* Stats Grid with Stagger */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center animate-fade-up stagger-1">
          <p className="text-3xl font-semibold text-success-500">{correctAnswers}</p>
          <p className="text-prose-secondary text-xs mt-1">Correct</p>
        </div>
        <div className="card text-center animate-fade-up stagger-2">
          <p className="text-3xl font-semibold text-danger-400">
            {passage.questions.length - correctAnswers}
          </p>
          <p className="text-prose-secondary text-xs mt-1">Incorrect</p>
        </div>
        <div className="card text-center animate-fade-up stagger-3">
          <p className="text-3xl font-semibold text-prose">
            {timeSpent ? formatTime(timeSpent) : '—'}
          </p>
          <p className="text-prose-secondary text-xs mt-1">Time</p>
        </div>
      </div>

      {/* Feedback Section */}
      <div className="card">
        <p className="text-sm font-medium text-prose mb-3">How was this session?</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setFeedback('easy')}
            className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
              feedback === 'easy'
                ? 'bg-primary-400 text-prose-inverse'
                : 'bg-muted text-prose hover:border-stroke-default'
            }`}
          >
            😌 Easy
          </button>
          <button
            onClick={() => setFeedback('perfect')}
            className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
              feedback === 'perfect'
                ? 'bg-success-500 text-prose-inverse'
                : 'bg-muted text-prose hover:border-stroke-default'
            }`}
          >
            👍 Perfect
          </button>
          <button
            onClick={() => setFeedback('difficult')}
            className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
              feedback === 'difficult'
                ? 'bg-warning-500 text-prose-inverse'
                : 'bg-muted text-prose hover:border-stroke-default'
            }`}
          >
            💪 Hard
          </button>
        </div>
      </div>

      {/* Answer Review */}
      <div className="card">
        <h2 className="text-base font-semibold text-prose mb-4">Answer Review</h2>
        <div className="space-y-3">
          {passage.questions.map((question, idx) => {
            const isCorrect = session.answers[idx] === question.correctAnswerIndex;
            return (
              <div
                key={question.id}
                className={`p-3 rounded-lg border-l-4 text-sm ${
                  isCorrect
                    ? 'bg-success-50 border-success-500'
                    : 'bg-danger-50 border-danger-400'
                }`}
              >
                <div className="flex gap-2">
                  <span className="text-lg">{isCorrect ? '✓' : '✗'}</span>
                  <div className="flex-1">
                    <p className="font-medium text-prose">{question.prompt}</p>
                    <p className="text-prose-secondary text-xs mt-1">
                      You: <span className="font-medium">{question.choices[session.answers[idx]]}</span>
                    </p>
                    {!isCorrect && (
                      <p className="text-prose-secondary text-xs mt-0.5">
                        Correct: <span className="font-medium text-success-600">{question.choices[question.correctAnswerIndex]}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dual CTA Buttons */}
      <div className="flex gap-3">
        <button onClick={handleSubmit} className="btn btn-primary flex-1">
          Continue Home →
        </button>
        <button
          onClick={() => navigate('/texts')}
          className="btn btn-secondary flex-1"
        >
          Try Another
        </button>
      </div>
    </div>
  );
}
