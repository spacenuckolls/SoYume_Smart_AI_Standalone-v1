// Simple tokenizer for text processing
export class Tokenizer {
  private vocabulary: Map<string, number> = new Map();
  private reverseVocabulary: Map<number, string> = new Map();
  private specialTokens: Map<string, number> = new Map();
  private maxLength: number = 512;

  constructor(vocabPath?: string, maxLength: number = 512) {
    this.maxLength = maxLength;
    this.initializeSpecialTokens();
    
    if (vocabPath) {
      this.loadVocabulary(vocabPath);
    } else {
      this.initializeBasicVocabulary();
    }
  }

  private initializeSpecialTokens(): void {
    // Common special tokens
    this.specialTokens.set('[PAD]', 0);
    this.specialTokens.set('[UNK]', 1);
    this.specialTokens.set('[CLS]', 2);
    this.specialTokens.set('[SEP]', 3);
    this.specialTokens.set('[MASK]', 4);
    this.specialTokens.set('<|startoftext|>', 5);
    this.specialTokens.set('<|endoftext|>', 6);

    // Add special tokens to vocabulary
    for (const [token, id] of this.specialTokens) {
      this.vocabulary.set(token, id);
      this.reverseVocabulary.set(id, token);
    }
  }

  private loadVocabulary(vocabPath: string): void {
    try {
      // In a real implementation, this would load from a file
      // For now, we'll use a basic vocabulary
      console.log(`Loading vocabulary from ${vocabPath} (placeholder)`);
      this.initializeBasicVocabulary();
    } catch (error) {
      console.warn('Failed to load vocabulary, using basic vocabulary:', error);
      this.initializeBasicVocabulary();
    }
  }

  private initializeBasicVocabulary(): void {
    // Start after special tokens
    let tokenId = this.specialTokens.size;

    // Common English words and punctuation
    const commonWords = [
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
      'this', 'that', 'these', 'those', 'here', 'there', 'where', 'when', 'why', 'how',
      'what', 'who', 'which', 'whose', 'whom', 'all', 'any', 'some', 'many', 'much',
      'said', 'say', 'says', 'go', 'goes', 'went', 'come', 'came', 'get', 'got', 'make', 'made',
      'take', 'took', 'see', 'saw', 'know', 'knew', 'think', 'thought', 'look', 'looked',
      'character', 'story', 'plot', 'scene', 'chapter', 'dialogue', 'narrative', 'protagonist',
      'antagonist', 'conflict', 'resolution', 'theme', 'setting', 'mood', 'tone', 'voice',
      'fantasy', 'romance', 'mystery', 'adventure', 'drama', 'comedy', 'thriller', 'horror'
    ];

    // Punctuation and symbols
    const punctuation = ['.', ',', '!', '?', ';', ':', '"', "'", '(', ')', '[', ']', '{', '}', '-', '_'];

    // Add common words
    for (const word of commonWords) {
      if (!this.vocabulary.has(word)) {
        this.vocabulary.set(word, tokenId);
        this.reverseVocabulary.set(tokenId, word);
        tokenId++;
      }
    }

    // Add punctuation
    for (const punct of punctuation) {
      if (!this.vocabulary.has(punct)) {
        this.vocabulary.set(punct, tokenId);
        this.reverseVocabulary.set(tokenId, punct);
        tokenId++;
      }
    }

    console.log(`Initialized basic vocabulary with ${tokenId} tokens`);
  }

  // Tokenize text into token IDs
  encode(text: string): number[] {
    const tokens = this.tokenize(text);
    const tokenIds = tokens.map(token => this.vocabulary.get(token) || this.specialTokens.get('[UNK]')!);
    
    // Add special tokens
    const encoded = [this.specialTokens.get('<|startoftext|>')!, ...tokenIds, this.specialTokens.get('<|endoftext|>')!];
    
    // Truncate or pad to max length
    if (encoded.length > this.maxLength) {
      return encoded.slice(0, this.maxLength);
    } else {
      const padToken = this.specialTokens.get('[PAD]')!;
      return [...encoded, ...Array(this.maxLength - encoded.length).fill(padToken)];
    }
  }

  // Decode token IDs back to text
  decode(tokenIds: number[]): string {
    const tokens = tokenIds
      .map(id => this.reverseVocabulary.get(id) || '[UNK]')
      .filter(token => !['[PAD]', '<|startoftext|>', '<|endoftext|>'].includes(token));
    
    return this.detokenize(tokens);
  }

  // Simple tokenization (word-level with punctuation separation)
  private tokenize(text: string): string[] {
    // Convert to lowercase and handle basic punctuation
    const normalized = text.toLowerCase()
      .replace(/([.!?;:,])/g, ' $1 ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return normalized.split(' ').filter(token => token.length > 0);
  }

  // Simple detokenization
  private detokenize(tokens: string[]): string {
    let text = tokens.join(' ');
    
    // Fix punctuation spacing
    text = text.replace(/\s+([.!?;:,])/g, '$1');
    text = text.replace(/\s+/g, ' ');
    
    return text.trim();
  }

  // Get token ID for a specific token
  getTokenId(token: string): number | undefined {
    return this.vocabulary.get(token);
  }

  // Get token for a specific ID
  getToken(tokenId: number): string | undefined {
    return this.reverseVocabulary.get(tokenId);
  }

  // Check if token exists in vocabulary
  hasToken(token: string): boolean {
    return this.vocabulary.has(token);
  }

  // Get vocabulary size
  getVocabularySize(): number {
    return this.vocabulary.size;
  }

  // Get special token IDs
  getSpecialTokens(): Map<string, number> {
    return new Map(this.specialTokens);
  }

  // Add new tokens to vocabulary (for fine-tuning)
  addToken(token: string): number {
    if (this.vocabulary.has(token)) {
      return this.vocabulary.get(token)!;
    }

    const tokenId = this.vocabulary.size;
    this.vocabulary.set(token, tokenId);
    this.reverseVocabulary.set(tokenId, token);
    
    return tokenId;
  }

  // Batch encoding for multiple texts
  encodeBatch(texts: string[]): number[][] {
    return texts.map(text => this.encode(text));
  }

  // Batch decoding for multiple token sequences
  decodeBatch(tokenIdsBatch: number[][]): string[] {
    return tokenIdsBatch.map(tokenIds => this.decode(tokenIds));
  }

  // Create attention mask (1 for real tokens, 0 for padding)
  createAttentionMask(tokenIds: number[]): number[] {
    const padToken = this.specialTokens.get('[PAD]')!;
    return tokenIds.map(id => id === padToken ? 0 : 1);
  }

  // Encode with attention mask
  encodeWithMask(text: string): { input_ids: number[], attention_mask: number[] } {
    const input_ids = this.encode(text);
    const attention_mask = this.createAttentionMask(input_ids);
    
    return { input_ids, attention_mask };
  }

  // Get vocabulary statistics
  getVocabularyStats(): any {
    const specialTokenCount = this.specialTokens.size;
    const regularTokenCount = this.vocabulary.size - specialTokenCount;
    
    return {
      totalTokens: this.vocabulary.size,
      specialTokens: specialTokenCount,
      regularTokens: regularTokenCount,
      maxLength: this.maxLength
    };
  }

  // Export vocabulary for saving
  exportVocabulary(): any {
    return {
      vocabulary: Object.fromEntries(this.vocabulary),
      specialTokens: Object.fromEntries(this.specialTokens),
      maxLength: this.maxLength
    };
  }

  // Import vocabulary from saved data
  importVocabulary(vocabData: any): void {
    this.vocabulary.clear();
    this.reverseVocabulary.clear();
    this.specialTokens.clear();

    // Import special tokens
    for (const [token, id] of Object.entries(vocabData.specialTokens)) {
      this.specialTokens.set(token, id as number);
    }

    // Import vocabulary
    for (const [token, id] of Object.entries(vocabData.vocabulary)) {
      this.vocabulary.set(token, id as number);
      this.reverseVocabulary.set(id as number, token);
    }

    this.maxLength = vocabData.maxLength || 512;
    
    console.log(`Imported vocabulary with ${this.vocabulary.size} tokens`);
  }
}