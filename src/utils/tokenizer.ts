import type { IpadicFeatures, Tokenizer } from 'kuromoji';
import kuromojiModule from 'kuromoji/build/kuromoji.js';

export interface Token {
  surface_form: string;
  reading?: string;
  basic_form?: string;
  part_of_speech: string;
  pos_detail_1?: string;
  pos_detail_2?: string;
  pos_detail_3?: string;
}

type KuromojiToken = IpadicFeatures;
type KuromojiTokenizer = Tokenizer<KuromojiToken>;
type KuromojiBrowserModule = {
  builder: (options: { dicPath: string }) => {
    build: (callback: (err: Error | null, tokenizer: KuromojiTokenizer | null) => void) => void;
  };
};

const kuromoji = kuromojiModule as KuromojiBrowserModule;

let tokenizerInstance: KuromojiTokenizer | null = null;
let loadingPromise: Promise<KuromojiTokenizer> | null = null;

export function getTokenizer(): Promise<KuromojiTokenizer> {
  if (tokenizerInstance) {
    return Promise.resolve(tokenizerInstance);
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: '/dict/' }).build((err, tokenizer) => {
      if (err || !tokenizer) {
        loadingPromise = null;
        reject(err ?? new Error('Failed to initialize kuromoji tokenizer.'));
        return;
      }

      tokenizerInstance = tokenizer;
      resolve(tokenizer);
    });
  });

  return loadingPromise;
}

export function tokenize(text: string, tokenizer: KuromojiTokenizer): Token[] {
  return tokenizer.tokenize(text).map((token) => ({
    surface_form: token.surface_form,
    reading: token.reading,
    basic_form: token.basic_form,
    part_of_speech: token.pos,
    pos_detail_1: token.pos_detail_1,
    pos_detail_2: token.pos_detail_2,
    pos_detail_3: token.pos_detail_3,
  }));
}

export function isHiragana(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  return cp >= 0x3040 && cp <= 0x309f;
}

export function isJapanese(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  return (
    (cp >= 0x3040 && cp <= 0x309f) ||
    (cp >= 0x30a0 && cp <= 0x30ff) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf)
  );
}

export function hasJapanese(token: Token): boolean {
  return [...token.surface_form].some(isJapanese);
}

const NOMINAL_SUFFIXES = new Set([
  'たち',
  'さま',
  'ども',
  'がた',
  'ら',
  'め',
  'っぽ',
  'ぽい',
]);

export function mergeTokens(tokens: Token[]): Token[] {
  const result: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const cur = tokens[i];
    const next = tokens[i + 1];

    if (
      next &&
      NOMINAL_SUFFIXES.has(next.surface_form) &&
      cur.part_of_speech === '名詞' &&
      (!['ら', 'め'].includes(next.surface_form) || next.pos_detail_1 === '接尾')
    ) {
      result.push({
        ...cur,
        surface_form: cur.surface_form + next.surface_form,
        basic_form: cur.surface_form + next.surface_form,
        reading: (cur.reading ?? cur.surface_form) + (next.reading ?? next.surface_form),
      });
      i += 2;
      continue;
    }

    if (
      next &&
      next.surface_form === 'する' &&
      cur.part_of_speech === '名詞' &&
      cur.pos_detail_1 === 'サ変接続'
    ) {
      result.push({
        ...cur,
        surface_form: cur.surface_form + 'する',
        basic_form: cur.surface_form + 'する',
        reading: (cur.reading ?? cur.surface_form) + 'スル',
        part_of_speech: '動詞',
        pos_detail_1: '自立',
      });
      i += 2;
      continue;
    }

    result.push(cur);
    i += 1;
  }

  return result;
}
