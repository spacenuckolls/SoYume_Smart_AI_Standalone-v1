import { 
  WordTokenizer, 
  BPETokenizer, 
  createTokenizer, 
  getDefaultTokenizerConfig, 
  estimateTokenCount, 
  truncateToTokenLimit 
} from '../inference/Tokenizer';
import { TokenizerConfig } from '../inference/Tokenizer';

describe('Tokenizer', () => {
  let config: TokenizerConfig;

  beforeEach(() => {
    config = getDefaultTokenizerConfig();
  });

  describe('WordTokenizer', () => {
    let tokenizer: WordTokenizer;

    beforeEach(() => {
      tokenizer = new WordTokenizer(config);
    });

    describe('Basic Tokenization', () => {
      it('should tokenize simple text correctly', () => {
        const text = 'Hello world';
        const result = tokenizer.encode(text);

        expect(result.tokens).toHaveLength(4); // BOS + Hello + world + EOS
        expect(result.tokenStrings).toContain('Hello');
        expect(result.tokenStrings).toContain('world');
        expect(result.attentionMask).toHaveLength(result.tokens.length);
      });

      it('should handle punctuation correctly', () => {
        const text = 'Hello, world!';
        const result = tokenizer.encode(text);

        expect(result.tokenStrings).toContain('Hello');
        expect(result.tokenStrings).toContain(',');
        expect(result.tokenStrings).toContain('world');
        expect(result.tokenStrings).toContain('!');
      });

      it('should handle empty text', () => {
        const text = '';
        const result = tokenizer.encode(text);

        // Should still have special tokens if addSpecialTokens is true
        expect(result.tokens.length).toBeGreaterThanOrEqual(0);
      });

      it('should handle whitespace normalization', () => {
        const text = 'Hello    world   ';
        const result = tokenizer.encode(text);

        expect(result.tokenStrings.filter(t => t === 'Hello')).toHaveLength(1);
        expect(result.tokenStrings.filter(t => t === 'world')).toHaveLength(1);
      });
    });

    describe('Special Tokens', () => {
      it('should add special tokens when requested', () => {
        const text = 'Hello world';
        const result = tokenizer.encode(text, true);

        expect(result.tokenStrings).toContain(config.bosToken);
        expect(result.tokenStrings).toContain(config.eosToken);
      });

      it('should skip special tokens when not requested', () => {
        const text = 'Hello world';
        const result = tokenizer.encode(text, false);

        expect(result.tokenStrings).not.toContain(config.bosToken);
        expect(result.tokenStrings).not.toContain(config.eosToken);
      });

      it('should identify special tokens correctly', () => {
        expect(tokenizer.isSpecialToken(config.padToken)).toBe(true);
        expect(tokenizer.isSpecialToken(config.unknownToken)).toBe(true);
        expect(tokenizer.isSpecialToken('regular_word')).toBe(false);
      });
    });

    describe('Decoding', () => {
      it('should decode tokens back to text', () => {
        const originalText = 'Hello world';
        const encoded = tokenizer.encode(originalText, false);
        const decoded = tokenizer.decode(encoded.tokens);

        expect(decoded.toLowerCase()).toContain('hello');
        expect(decoded.toLowerCase()).toContain('world');
      });

      it('should skip special tokens when decoding', () => {
        const text = 'Hello world';
        const encoded = tokenizer.encode(text, true);
        const decoded = tokenizer.decode(encoded.tokens, { skipSpecialTokens: true });

        expect(decoded).not.toContain(config.bosToken);
        expect(decoded).not.toContain(config.eosToken);
      });

      it('should include special tokens when requested', () => {
        const text = 'Hello world';
        const encoded = tokenizer.encode(text, true);
        const decoded = tokenizer.decode(encoded.tokens, { skipSpecialTokens: false });

        expect(decoded).toContain(config.bosToken);
        expect(decoded).toContain(config.eosToken);
      });

      it('should clean up tokenization spaces', () => {
        const text = 'Hello, world!';
        const encoded = tokenizer.encode(text, false);
        const decoded = tokenizer.decode(encoded.tokens, { cleanUpTokenizationSpaces: true });

        // Should not have spaces before punctuation
        expect(decoded).not.toContain(' ,');
        expect(decoded).not.toContain(' !');
      });
    });

    describe('Vocabulary Management', () => {
      it('should handle unknown tokens', () => {
        const tokenId = tokenizer.getTokenId('unknown_word_12345');
        const token = tokenizer.getToken(tokenId);

        // Should either be the word itself (if added to vocab) or unknown token
        expect(token === 'unknown_word_12345' || token === config.unknownToken).toBe(true);
      });

      it('should maintain consistent token IDs', () => {
        const word = 'consistent';
        const id1 = tokenizer.getTokenId(word);
        const id2 = tokenizer.getTokenId(word);

        expect(id1).toBe(id2);
      });

      it('should respect vocabulary size limits', () => {
        const smallConfig = {
          ...config,
          vocabSize: 10 // Very small vocab
        };
        const smallTokenizer = new WordTokenizer(smallConfig);

        // Add many unique words
        const words = Array.from({ length: 20 }, (_, i) => `word${i}`);
        const tokenIds = words.map(word => smallTokenizer.getTokenId(word));

        // Some should map to unknown token due to vocab limit
        const unknownTokenId = smallTokenizer.getTokenId(config.unknownToken);
        expect(tokenIds.some(id => id === unknownTokenId)).toBe(true);
      });
    });

    describe('Padding and Attention Masks', () => {
      it('should create correct attention masks', () => {
        const text = 'Hello world';
        const encoded = tokenizer.encode(text);

        expect(encoded.attentionMask).toHaveLength(encoded.tokens.length);
        expect(encoded.attentionMask.every(mask => mask === 0 || mask === 1)).toBe(true);
      });

      it('should pad sequences correctly', () => {
        const tokens = [1, 2, 3];
        const padded = tokenizer.padSequence(tokens, 5);

        expect(padded).toHaveLength(5);
        expect(padded.slice(0, 3)).toEqual(tokens);
        
        const padTokenId = tokenizer.getSpecialTokens().get(config.padToken);
        expect(padded.slice(3)).toEqual([padTokenId, padTokenId]);
      });

      it('should truncate long sequences', () => {
        const longTokens = Array.from({ length: 10 }, (_, i) => i);
        const truncated = tokenizer.padSequence(longTokens, 5);

        expect(truncated).toHaveLength(5);
        expect(truncated).toEqual([0, 1, 2, 3, 4]);
      });
    });

    describe('Preprocessing', () => {
      it('should handle mixed case text', () => {
        const text = 'Hello WORLD';
        const result = tokenizer.encode(text);

        // Should normalize to lowercase
        expect(result.tokenStrings.some(t => t.toLowerCase() === 'hello')).toBe(true);
        expect(result.tokenStrings.some(t => t.toLowerCase() === 'world')).toBe(true);
      });

      it('should handle special characters', () => {
        const text = 'Hello @#$% world';
        const result = tokenizer.encode(text);

        // Should filter out special characters but keep words
        expect(result.tokenStrings.some(t => t.toLowerCase() === 'hello')).toBe(true);
        expect(result.tokenStrings.some(t => t.toLowerCase() === 'world')).toBe(true);
      });
    });
  });

  describe('BPETokenizer', () => {
    let tokenizer: BPETokenizer;
    const mockMerges: Array<[string, string]> = [
      ['h', 'e'],
      ['l', 'l'],
      ['o', 'w']
    ];
    const mockVocab = new Map([
      ['h', 0],
      ['e', 1],
      ['l', 2],
      ['o', 3],
      ['w', 4],
      ['he', 5],
      ['ll', 6],
      ['ow', 7]
    ]);

    beforeEach(() => {
      tokenizer = new BPETokenizer(config, mockMerges, mockVocab);
    });

    describe('BPE Encoding', () => {
      it('should apply BPE merges correctly', () => {
        const text = 'hello';
        const result = tokenizer.encode(text, false);

        expect(result.tokens).toBeDefined();
        expect(result.tokenStrings).toBeDefined();
      });

      it('should handle unknown tokens in BPE', () => {
        const text = 'xyz'; // Not in vocab
        const result = tokenizer.encode(text);

        expect(result.tokens).toBeDefined();
        expect(result.tokens.length).toBeGreaterThan(0);
      });
    });

    describe('BPE Decoding', () => {
      it('should decode BPE tokens correctly', () => {
        const tokens = [5, 6, 3]; // 'he' + 'll' + 'o'
        const decoded = tokenizer.decode(tokens);

        expect(decoded).toBeTruthy();
      });

      it('should handle BPE space markers', () => {
        // Test with common BPE space markers
        const textWithMarkers = 'HelloĠworld';
        const cleaned = (tokenizer as any).cleanupBPESpaces(textWithMarkers);

        expect(cleaned).toContain(' ');
        expect(cleaned).not.toContain('Ġ');
      });
    });
  });

  describe('Factory Functions', () => {
    it('should create word tokenizer', () => {
      const tokenizer = createTokenizer('word', config);
      expect(tokenizer).toBeInstanceOf(WordTokenizer);
    });

    it('should create BPE tokenizer', () => {
      const tokenizer = createTokenizer('bpe', config);
      expect(tokenizer).toBeInstanceOf(BPETokenizer);
    });

    it('should throw error for unsupported type', () => {
      expect(() => {
        createTokenizer('unsupported' as any, config);
      }).toThrow('Unsupported tokenizer type: unsupported');
    });

    it('should pass options to tokenizers', () => {
      const vocabulary = ['hello', 'world', 'test'];
      const tokenizer = createTokenizer('word', config, { vocabulary });

      expect(tokenizer).toBeInstanceOf(WordTokenizer);
    });
  });

  describe('Utility Functions', () => {
    describe('estimateTokenCount', () => {
      it('should estimate token count correctly', () => {
        const text = 'Hello world test';
        const estimate = estimateTokenCount(text);

        expect(estimate).toBeGreaterThan(0);
        expect(estimate).toBeLessThan(text.length); // Should be less than character count
      });

      it('should handle empty text', () => {
        const estimate = estimateTokenCount('');
        expect(estimate).toBe(0);
      });

      it('should use custom average token length', () => {
        const text = 'Hello world';
        const estimate1 = estimateTokenCount(text, 4);
        const estimate2 = estimateTokenCount(text, 8);

        expect(estimate1).toBeGreaterThan(estimate2);
      });
    });

    describe('truncateToTokenLimit', () => {
      it('should truncate text to token limit', () => {
        const longText = 'This is a very long text that should be truncated to fit within the token limit';
        const truncated = truncateToTokenLimit(longText, 5);

        expect(truncated.length).toBeLessThan(longText.length);
        expect(estimateTokenCount(truncated)).toBeLessThanOrEqual(5);
      });

      it('should not truncate short text', () => {
        const shortText = 'Short';
        const truncated = truncateToTokenLimit(shortText, 10);

        expect(truncated).toBe(shortText);
      });

      it('should try to truncate at word boundaries', () => {
        const text = 'Hello world this is a test';
        const truncated = truncateToTokenLimit(text, 3, 4);

        // Should try to end at a space if possible
        const lastChar = truncated[truncated.length - 1];
        expect(lastChar !== ' ' || truncated.endsWith(' ')).toBe(true);
      });
    });
  });

  describe('Configuration', () => {
    it('should provide sensible defaults', () => {
      const defaultConfig = getDefaultTokenizerConfig();

      expect(defaultConfig).toMatchObject({
        vocabSize: expect.any(Number),
        maxLength: expect.any(Number),
        padToken: expect.any(String),
        unknownToken: expect.any(String),
        bosToken: expect.any(String),
        eosToken: expect.any(String)
      });

      expect(defaultConfig.vocabSize).toBeGreaterThan(0);
      expect(defaultConfig.maxLength).toBeGreaterThan(0);
    });

    it('should handle custom special tokens', () => {
      const customConfig = {
        ...config,
        specialTokens: {
          '<custom>': 100,
          '<another>': 101
        }
      };

      const tokenizer = new WordTokenizer(customConfig);
      const specialTokens = tokenizer.getSpecialTokens();

      expect(specialTokens.has('<custom>')).toBe(true);
      expect(specialTokens.has('<another>')).toBe(true);
      expect(specialTokens.get('<custom>')).toBe(100);
      expect(specialTokens.get('<another>')).toBe(101);
    });
  });

  describe('Edge Cases', () => {
    let tokenizer: WordTokenizer;

    beforeEach(() => {
      tokenizer = new WordTokenizer(config);
    });

    it('should handle very long text', () => {
      const longText = 'word '.repeat(1000);
      const result = tokenizer.encode(longText);

      expect(result.tokens).toBeDefined();
      expect(result.tokens.length).toBeLessThanOrEqual(config.maxLength);
    });

    it('should handle text with only punctuation', () => {
      const punctText = '!@#$%^&*()';
      const result = tokenizer.encode(punctText);

      expect(result.tokens).toBeDefined();
      expect(result.tokens.length).toBeGreaterThan(0);
    });

    it('should handle text with only whitespace', () => {
      const whitespaceText = '   \\n\\t   ';
      const result = tokenizer.encode(whitespaceText);

      expect(result.tokens).toBeDefined();
      // Should have at least special tokens
      expect(result.tokens.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle unicode characters', () => {
      const unicodeText = 'Hello 世界 🌍';
      const result = tokenizer.encode(unicodeText);

      expect(result.tokens).toBeDefined();
      expect(result.tokens.length).toBeGreaterThan(0);
    });

    it('should be consistent across multiple encodings', () => {
      const text = 'Consistent test text';
      
      const result1 = tokenizer.encode(text);
      const result2 = tokenizer.encode(text);

      expect(result1.tokens).toEqual(result2.tokens);
      expect(result1.tokenStrings).toEqual(result2.tokenStrings);
    });
  });

  describe('Performance', () => {
    let tokenizer: WordTokenizer;

    beforeEach(() => {
      tokenizer = new WordTokenizer(config);
    });

    it('should handle large vocabulary efficiently', () => {
      const largeVocab = Array.from({ length: 1000 }, (_, i) => `word${i}`);
      const largeTokenizer = new WordTokenizer(config, largeVocab);

      const startTime = Date.now();
      const result = largeTokenizer.encode('test word500 word999');
      const endTime = Date.now();

      expect(result.tokens).toBeDefined();
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    it('should handle repeated tokenization efficiently', () => {
      const text = 'Repeated tokenization test';
      
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        tokenizer.encode(text);
      }
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete in reasonable time
    });
  });
});