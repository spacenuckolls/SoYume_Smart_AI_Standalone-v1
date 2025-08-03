import { Tokenizer } from '../inference/Tokenizer';

describe('Tokenizer', () => {
  let tokenizer: Tokenizer;

  beforeEach(() => {
    tokenizer = new Tokenizer(undefined, 128); // Use smaller max length for testing
  });

  describe('initialization', () => {
    it('should initialize with default settings', () => {
      const defaultTokenizer = new Tokenizer();
      
      expect(defaultTokenizer.getVocabularySize()).toBeGreaterThan(0);
      expect(defaultTokenizer.hasToken('[PAD]')).toBe(true);
      expect(defaultTokenizer.hasToken('[UNK]')).toBe(true);
      expect(defaultTokenizer.hasToken('<|startoftext|>')).toBe(true);
      expect(defaultTokenizer.hasToken('<|endoftext|>')).toBe(true);
    });

    it('should initialize with custom max length', () => {
      const customTokenizer = new Tokenizer(undefined, 256);
      const stats = customTokenizer.getVocabularyStats();
      
      expect(stats.maxLength).toBe(256);
    });

    it('should have special tokens', () => {
      const specialTokens = tokenizer.getSpecialTokens();
      
      expect(specialTokens.has('[PAD]')).toBe(true);
      expect(specialTokens.has('[UNK]')).toBe(true);
      expect(specialTokens.has('[CLS]')).toBe(true);
      expect(specialTokens.has('[SEP]')).toBe(true);
      expect(specialTokens.has('[MASK]')).toBe(true);
      expect(specialTokens.has('<|startoftext|>')).toBe(true);
      expect(specialTokens.has('<|endoftext|>')).toBe(true);
    });
  });

  describe('tokenization', () => {
    it('should encode text to token IDs', () => {
      const text = 'The character walked through the forest.';
      const tokenIds = tokenizer.encode(text);
      
      expect(Array.isArray(tokenIds)).toBe(true);
      expect(tokenIds.length).toBe(128); // Should be padded to max length
      expect(tokenIds[0]).toBe(tokenizer.getTokenId('<|startoftext|>'));
      expect(tokenIds.includes(tokenizer.getTokenId('<|endoftext|>')!)).toBe(true);
    });

    it('should decode token IDs back to text', () => {
      const originalText = 'The hero saved the day.';
      const tokenIds = tokenizer.encode(originalText);
      const decodedText = tokenizer.decode(tokenIds);
      
      expect(typeof decodedText).toBe('string');
      expect(decodedText.length).toBeGreaterThan(0);
      // Should contain key words from original text
      expect(decodedText.toLowerCase()).toContain('hero');
      expect(decodedText.toLowerCase()).toContain('saved');
    });

    it('should handle unknown tokens', () => {
      const text = 'This contains unknownword123 that is not in vocabulary.';
      const tokenIds = tokenizer.encode(text);
      
      expect(tokenIds.includes(tokenizer.getTokenId('[UNK]')!)).toBe(true);
    });

    it('should handle empty text', () => {
      const tokenIds = tokenizer.encode('');
      
      expect(tokenIds.length).toBe(128);
      expect(tokenIds[0]).toBe(tokenizer.getTokenId('<|startoftext|>'));
      expect(tokenIds[1]).toBe(tokenizer.getTokenId('<|endoftext|>'));
      // Rest should be padding
      for (let i = 2; i < tokenIds.length; i++) {
        expect(tokenIds[i]).toBe(tokenizer.getTokenId('[PAD]'));
      }
    });

    it('should truncate long text', () => {
      const longText = 'word '.repeat(200); // Much longer than max length
      const tokenIds = tokenizer.encode(longText);
      
      expect(tokenIds.length).toBe(128);
      expect(tokenIds[0]).toBe(tokenizer.getTokenId('<|startoftext|>'));
    });
  });

  describe('vocabulary management', () => {
    it('should get token ID for existing token', () => {
      const tokenId = tokenizer.getTokenId('the');
      
      expect(typeof tokenId).toBe('number');
      expect(tokenId).toBeGreaterThanOrEqual(0);
    });

    it('should return undefined for non-existent token', () => {
      const tokenId = tokenizer.getTokenId('nonexistenttoken123');
      
      expect(tokenId).toBeUndefined();
    });

    it('should get token for existing ID', () => {
      const padTokenId = tokenizer.getTokenId('[PAD]')!;
      const token = tokenizer.getToken(padTokenId);
      
      expect(token).toBe('[PAD]');
    });

    it('should return undefined for non-existent ID', () => {
      const token = tokenizer.getToken(99999);
      
      expect(token).toBeUndefined();
    });

    it('should check if token exists', () => {
      expect(tokenizer.hasToken('the')).toBe(true);
      expect(tokenizer.hasToken('nonexistenttoken123')).toBe(false);
    });

    it('should add new tokens', () => {
      const newToken = 'newtesttoken';
      
      expect(tokenizer.hasToken(newToken)).toBe(false);
      
      const tokenId = tokenizer.addToken(newToken);
      
      expect(tokenizer.hasToken(newToken)).toBe(true);
      expect(tokenizer.getTokenId(newToken)).toBe(tokenId);
      expect(tokenizer.getToken(tokenId)).toBe(newToken);
    });

    it('should return existing ID when adding duplicate token', () => {
      const existingToken = 'the';
      const originalId = tokenizer.getTokenId(existingToken)!;
      
      const newId = tokenizer.addToken(existingToken);
      
      expect(newId).toBe(originalId);
    });
  });

  describe('batch operations', () => {
    it('should encode multiple texts', () => {
      const texts = [
        'First story about a hero.',
        'Second story about a villain.',
        'Third story about friendship.'
      ];
      
      const batchTokenIds = tokenizer.encodeBatch(texts);
      
      expect(Array.isArray(batchTokenIds)).toBe(true);
      expect(batchTokenIds.length).toBe(3);
      batchTokenIds.forEach(tokenIds => {
        expect(Array.isArray(tokenIds)).toBe(true);
        expect(tokenIds.length).toBe(128);
      });
    });

    it('should decode multiple token sequences', () => {
      const texts = ['Hero saves day.', 'Villain plots revenge.'];
      const batchTokenIds = tokenizer.encodeBatch(texts);
      const decodedTexts = tokenizer.decodeBatch(batchTokenIds);
      
      expect(Array.isArray(decodedTexts)).toBe(true);
      expect(decodedTexts.length).toBe(2);
      decodedTexts.forEach(text => {
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(0);
      });
    });
  });

  describe('attention masks', () => {
    it('should create attention mask', () => {
      const text = 'Short text.';
      const tokenIds = tokenizer.encode(text);
      const attentionMask = tokenizer.createAttentionMask(tokenIds);
      
      expect(Array.isArray(attentionMask)).toBe(true);
      expect(attentionMask.length).toBe(tokenIds.length);
      
      // Should have 1s for real tokens and 0s for padding
      const padTokenId = tokenizer.getTokenId('[PAD]')!;
      for (let i = 0; i < tokenIds.length; i++) {
        if (tokenIds[i] === padTokenId) {
          expect(attentionMask[i]).toBe(0);
        } else {
          expect(attentionMask[i]).toBe(1);
        }
      }
    });

    it('should encode with attention mask', () => {
      const text = 'Test text for attention mask.';
      const result = tokenizer.encodeWithMask(text);
      
      expect(result).toHaveProperty('input_ids');
      expect(result).toHaveProperty('attention_mask');
      expect(Array.isArray(result.input_ids)).toBe(true);
      expect(Array.isArray(result.attention_mask)).toBe(true);
      expect(result.input_ids.length).toBe(result.attention_mask.length);
    });
  });

  describe('vocabulary statistics', () => {
    it('should return vocabulary statistics', () => {
      const stats = tokenizer.getVocabularyStats();
      
      expect(stats).toHaveProperty('totalTokens');
      expect(stats).toHaveProperty('specialTokens');
      expect(stats).toHaveProperty('regularTokens');
      expect(stats).toHaveProperty('maxLength');
      
      expect(typeof stats.totalTokens).toBe('number');
      expect(typeof stats.specialTokens).toBe('number');
      expect(typeof stats.regularTokens).toBe('number');
      expect(typeof stats.maxLength).toBe('number');
      
      expect(stats.totalTokens).toBe(stats.specialTokens + stats.regularTokens);
      expect(stats.maxLength).toBe(128);
    });

    it('should have correct special token count', () => {
      const stats = tokenizer.getVocabularyStats();
      const specialTokens = tokenizer.getSpecialTokens();
      
      expect(stats.specialTokens).toBe(specialTokens.size);
    });
  });

  describe('vocabulary export/import', () => {
    it('should export vocabulary', () => {
      const exported = tokenizer.exportVocabulary();
      
      expect(exported).toHaveProperty('vocabulary');
      expect(exported).toHaveProperty('specialTokens');
      expect(exported).toHaveProperty('maxLength');
      
      expect(typeof exported.vocabulary).toBe('object');
      expect(typeof exported.specialTokens).toBe('object');
      expect(typeof exported.maxLength).toBe('number');
    });

    it('should import vocabulary', () => {
      const originalStats = tokenizer.getVocabularyStats();
      const exported = tokenizer.exportVocabulary();
      
      // Create new tokenizer and import
      const newTokenizer = new Tokenizer();
      newTokenizer.importVocabulary(exported);
      
      const newStats = newTokenizer.getVocabularyStats();
      
      expect(newStats.totalTokens).toBe(originalStats.totalTokens);
      expect(newStats.specialTokens).toBe(originalStats.specialTokens);
      expect(newStats.maxLength).toBe(originalStats.maxLength);
      
      // Test that tokens work the same
      expect(newTokenizer.getTokenId('the')).toBe(tokenizer.getTokenId('the'));
      expect(newTokenizer.getTokenId('[PAD]')).toBe(tokenizer.getTokenId('[PAD]'));
    });

    it('should maintain functionality after import', () => {
      const exported = tokenizer.exportVocabulary();
      const newTokenizer = new Tokenizer();
      newTokenizer.importVocabulary(exported);
      
      const text = 'Test text for import functionality.';
      const originalTokenIds = tokenizer.encode(text);
      const newTokenIds = newTokenizer.encode(text);
      
      expect(newTokenIds).toEqual(originalTokenIds);
      
      const originalDecoded = tokenizer.decode(originalTokenIds);
      const newDecoded = newTokenizer.decode(newTokenIds);
      
      expect(newDecoded).toBe(originalDecoded);
    });
  });

  describe('edge cases', () => {
    it('should handle text with only punctuation', () => {
      const text = '!@#$%^&*()';
      const tokenIds = tokenizer.encode(text);
      
      expect(Array.isArray(tokenIds)).toBe(true);
      expect(tokenIds.length).toBe(128);
    });

    it('should handle text with mixed case', () => {
      const text = 'MiXeD CaSe TeXt WiTh UPPERCASE and lowercase';
      const tokenIds = tokenizer.encode(text);
      const decoded = tokenizer.decode(tokenIds);
      
      // Should be normalized to lowercase
      expect(decoded.toLowerCase()).toBe(decoded);
    });

    it('should handle text with multiple spaces', () => {
      const text = 'Text    with     multiple     spaces';
      const tokenIds = tokenizer.encode(text);
      const decoded = tokenizer.decode(tokenIds);
      
      // Should normalize spaces
      expect(decoded).not.toContain('  '); // No double spaces
    });

    it('should handle very short text', () => {
      const text = 'Hi';
      const tokenIds = tokenizer.encode(text);
      
      expect(tokenIds.length).toBe(128);
      expect(tokenIds[0]).toBe(tokenizer.getTokenId('<|startoftext|>'));
    });

    it('should handle text with numbers', () => {
      const text = 'Chapter 123 has 456 words.';
      const tokenIds = tokenizer.encode(text);
      const decoded = tokenizer.decode(tokenIds);
      
      expect(decoded).toContain('chapter');
      expect(decoded).toContain('123');
      expect(decoded).toContain('456');
    });
  });
});