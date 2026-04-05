export function isJapanese(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  return (
    (cp >= 0x3040 && cp <= 0x309f) ||
    (cp >= 0x30a0 && cp <= 0x30ff) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0xf900 && cp <= 0xfaff)
  );
}

export function extractWordAt(text: string, offset: number): string {
  if (!text || offset < 0 || offset >= text.length) return '';

  let start = offset;
  let end = offset;

  while (start > 0 && isJapanese(text[start - 1])) start -= 1;
  while (end < text.length - 1 && isJapanese(text[end + 1])) end += 1;

  const run = text.slice(start, end + 1);
  if (run.length <= 6) return run;

  const localOffset = offset - start;
  const windowStart = Math.max(0, localOffset - 2);
  return run.slice(windowStart, windowStart + 5);
}

export interface TextSegment {
  text: string;
  isJapanese: boolean;
}

export function splitIntoSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  if (!text) return segments;

  let current = '';
  let currentIsJapanese = isJapanese(text[0]);

  for (const ch of text) {
    const chIsJapanese = isJapanese(ch);
    if (chIsJapanese === currentIsJapanese) {
      current += ch;
      continue;
    }

    if (current) {
      segments.push({ text: current, isJapanese: currentIsJapanese });
    }

    current = ch;
    currentIsJapanese = chIsJapanese;
  }

  if (current) {
    segments.push({ text: current, isJapanese: currentIsJapanese });
  }

  return segments;
}
