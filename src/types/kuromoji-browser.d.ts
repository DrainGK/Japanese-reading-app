declare module 'kuromoji/build/kuromoji.js' {
  import type { IpadicFeatures, Tokenizer, TokenizerBuilder } from 'kuromoji';

  const kuromoji: {
    builder(option: { dicPath: string }): TokenizerBuilder<IpadicFeatures> & {
      build(callback: (err: Error | null, tokenizer: Tokenizer<IpadicFeatures> | null) => void): void;
    };
  };

  export default kuromoji;
}
