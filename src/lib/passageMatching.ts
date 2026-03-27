import { ReadingPassage } from '../types';

export function getMatchingVocabularyTokens(
  text: string,
  vocabularyTokens: Iterable<string>
): Set<string> {
  const matches = new Set<string>();

  for (const token of vocabularyTokens) {
    if (token && text.includes(token)) {
      matches.add(token);
    }
  }

  return matches;
}

export function countMatchingVocabularyInPassage(
  passage: ReadingPassage,
  vocabularyTokens: Iterable<string>
): number {
  return getMatchingVocabularyTokens(passage.text, vocabularyTokens).size;
}

export function hasMatchingVocabularyInPassage(
  passage: ReadingPassage,
  vocabularyTokens: Iterable<string>
): boolean {
  return countMatchingVocabularyInPassage(passage, vocabularyTokens) > 0;
}
