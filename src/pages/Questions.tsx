import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { passages } from '../data/passages';
import { useSession } from '../hooks/useSession';

export function QuestionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, answerQuestion, nextQuestion, previousQuestion, resetSession } = useSession();
  const [hasAnswered, setHasAnswered] = useState(false);

  const passage = passages.find((p) => p.id === id);

  useEffect(() => {
    if (!passage || !session.passage || session.passage.id !== passage.id) {
      navigate('/');
      return;
    }
  }, [passage, session.passage, navigate]);

  if (!passage || !session.passage) {
    return <div className="text-center py-12">Loading...</div>;
  }

  const currentQuestion = passage.questions[session.currentQuestionIndex];
  const isLastQuestion = session.currentQuestionIndex === passage.questions.length - 1;
  const currentAnswer = session.answers[session.currentQuestionIndex];

  const handleSelectAnswer = (index: number) => {
    if (!hasAnswered) {
      answerQuestion(index);
      setHasAnswered(true);
    }
  };

  const handleNext = () => {
    if (isLastQuestion) {
      navigate(`/results/${passage.id}`);
    } else {
      setHasAnswered(false);
      nextQuestion();
    }
  };

  const handlePrevious = () => {
    if (session.currentQuestionIndex > 0) {
      setHasAnswered(session.answers[session.currentQuestionIndex - 1] !== undefined);
      previousQuestion();
    }
  };

  const handleBack = () => {
    resetSession();
    navigate('/');
  };

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={handleBack}
          className="text-indigo-600 hover:text-indigo-700 font-medium"
        >
          ← Back
        </button>
        <div className="text-sm font-medium text-gray-600">
          Question {session.currentQuestionIndex + 1} of {passage.questions.length}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${((session.currentQuestionIndex + 1) / passage.questions.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="card mb-8">
        {/* Question Metadata */}
        <div className="mb-6">
          <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 mb-3 capitalize">
            {currentQuestion.type.replace('-', ' ')}
          </span>
          <h2 className="text-xl font-bold text-gray-800">{currentQuestion.prompt}</h2>
        </div>

        {/* Answer Choices */}
        <div className="space-y-3 mb-6">
          {currentQuestion.choices.map((choice, index) => (
            <button
              key={index}
              onClick={() => handleSelectAnswer(index)}
              disabled={hasAnswered}
              className={`w-full p-4 rounded-lg text-left transition-all border-2 ${
                currentAnswer === index
                  ? index === currentQuestion.correctAnswerIndex
                    ? 'border-green-500 bg-green-50'
                    : 'border-red-500 bg-red-50'
                  : hasAnswered && index === currentQuestion.correctAnswerIndex
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-indigo-200 hover:bg-indigo-50'
              } ${hasAnswered ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-medium ${
                    currentAnswer === index
                      ? index === currentQuestion.correctAnswerIndex
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-red-500 bg-red-500 text-white'
                      : hasAnswered && index === currentQuestion.correctAnswerIndex
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-gray-300'
                  }`}
                >
                  {currentAnswer === index && index === currentQuestion.correctAnswerIndex && '✓'}
                  {currentAnswer === index && index !== currentQuestion.correctAnswerIndex && '✗'}
                  {currentAnswer !== index && hasAnswered && index === currentQuestion.correctAnswerIndex && '✓'}
                </div>
                <span className="font-medium text-gray-800">{choice}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Explanation */}
        {hasAnswered && (
          <div
            className={`p-4 rounded-lg border-l-4 ${
              currentAnswer === currentQuestion.correctAnswerIndex
                ? 'bg-green-50 border-green-500'
                : 'bg-amber-50 border-amber-500'
            }`}
          >
            <p className="text-sm font-medium text-gray-800 mb-1">
              {currentAnswer === currentQuestion.correctAnswerIndex ? '✓ Correct!' : '✗ Incorrect'}
            </p>
            <p className="text-sm text-gray-700">{currentQuestion.explanation}</p>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handlePrevious}
          disabled={session.currentQuestionIndex === 0}
          className="btn btn-secondary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>
        <button
          onClick={handleNext}
          disabled={!hasAnswered}
          className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLastQuestion ? 'Submit Answers →' : 'Next →'}
        </button>
      </div>

      {!hasAnswered && (
        <p className="text-center text-sm text-gray-600 mt-4">
          Select an answer to continue
        </p>
      )}
    </div>
  );
}
