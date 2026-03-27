export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateOnly = date.toISOString().split('T')[0];
  const todayOnly = today.toISOString().split('T')[0];
  const yesterdayOnly = yesterday.toISOString().split('T')[0];

  if (dateOnly === todayOnly) {
    return 'Today';
  } else if (dateOnly === yesterdayOnly) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

export function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) return '-';

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (minutes === 0) {
    return `${secs}s`;
  }

  return `${minutes}m ${secs}s`;
}

export function calculateReadingTime(
  _text: string,
  estimatedMinutes: number
): number {
  // Return the estimated time from passage metadata
  return estimatedMinutes;
}

export function extractKanjiFromText(textContent: string): Set<string> {
  // Simple kanji extraction using Unicode ranges
  const kanjiRegex = /[\u4E00-\u9FFF]/g;
  const matches = textContent.match(kanjiRegex);
  return new Set(matches || []);
}

export function extractVocabFromText(text: string): Set<string> {
  // This is simplified - in a real app, you'd use a proper tokenizer
  // For now, we'll look for hiragana/katakana sequences
  const wordRegex = /[\u3040-\u309F\u30A0-\u30FF]+/g;
  const matches = text.match(wordRegex);
  return new Set(matches || []);
}

export function calculateScorePercentage(
  correctAnswers: number,
  totalQuestions: number
): number {
  return totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
}

export function getScoreFeedback(percentage: number): string {
  if (percentage === 100) {
    return '🎉 Perfect!';
  } else if (percentage >= 80) {
    return '👏 Excellent!';
  } else if (percentage >= 60) {
    return '👍 Good!';
  } else if (percentage >= 40) {
    return '💪 Keep practicing!';
  } else {
    return '📚 Review and try again!';
  }
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}
