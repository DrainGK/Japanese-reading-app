export interface JishoSense {
  english_definitions: string[];
  parts_of_speech: string[];
  tags: string[];
  restrictions: string[];
}

export interface JishoJapanese {
  word?: string;
  reading: string;
}

export interface JishoResult {
  slug: string;
  is_common: boolean;
  tags: string[];
  jlpt: string[];
  japanese: JishoJapanese[];
  senses: JishoSense[];
}

interface JishoResponse {
  data: JishoResult[];
}

const FETCH_TIMEOUT_MS = 7000;
const JISHO_SEARCH_ENDPOINT =
  import.meta.env.VITE_JISHO_API_BASE ?? '/api/jisho/search';

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function searchJisho(word: string): Promise<JishoResult[]> {
  if (!navigator.onLine) {
    return [];
  }

  const url = `${JISHO_SEARCH_ENDPOINT}?keyword=${encodeURIComponent(word)}`;
  try {
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);

    if (!res.ok) {
      return [];
    }

    const json = (await res.json()) as JishoResponse;
    return (json.data || []).slice(0, 3);
  } catch {
    return [];
  }
}

export function getBestMatch(result: JishoResult): { word: string; reading: string } {
  const jp = result.japanese[0];
  if (!jp) {
    return { word: result.slug, reading: result.slug };
  }

  return {
    word: jp.word ?? jp.reading,
    reading: jp.reading,
  };
}

export const getBestForm = getBestMatch;

export function getJLPT(result: JishoResult): string | null {
  const tag = result.jlpt[0];
  if (!tag) return null;
  return tag.replace('jlpt-', '').toUpperCase();
}
