import { Story, Scene, Character, ExportFormat, ExportOptions, ExportResult } from '../../shared/types/Story';
import { AIProviderRegistry } from '../ai/providers/AIProviderRegistry';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ExportConfiguration {
  format: ExportFormat;
  options: ExportOptions;
  outputPath: string;
  includeMetadata: boolean;
  customTemplate?: string;
}

export interface FormatTemplate {
  name: string;
  description: string;
  fileExtension: string;
  mimeType: string;
  supportsFormatting: boolean;
  supportsMetadata: boolean;
  industryStandard: boolean;
}

export interface PublishingMetadata {
  title: string;
  author: string;
  genre: string;
  wordCount: number;
  pageCount: number;
  isbn?: string;
  publisher?: string;
  publicationDate?: Date;
  copyright: string;
  description: string;
  keywords: string[];
}

export interface QueryLetterData {
  bookTitle: string;
  genre: string;
  wordCount: number;
  logline: string;
  synopsis: string;
  authorBio: string;
  credentials: string[];
  comparableTitles: string[];
}

export interface SynopsisData {
  title: string;
  genre: string;
  wordCount: number;
  mainCharacters: string[];
  plotSummary: string;
  themes: string[];
  targetAudience: string;
}

export class ExportManager {
  private aiRegistry: AIProviderRegistry;
  private formatTemplates: Map<ExportFormat, FormatTemplate> = new Map();
  private customTemplates: Map<string, string> = new Map();

  constructor(aiRegistry: AIProviderRegistry) {
    this.aiRegistry = aiRegistry;
    this.initializeFormatTemplates();
  }

  private initializeFormatTemplates(): void {
    // Novel formats
    this.formatTemplates.set('docx', {
      name: 'Microsoft Word Document',
      description: 'Standard manuscript format for submissions',
      fileExtension: '.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      supportsFormatting: true,
      supportsMetadata: true,
      industryStandard: true
    });

    this.formatTemplates.set('pdf', {
      name: 'Portable Document Format',
      description: 'Professional document format for final drafts',
      fileExtension: '.pdf',
      mimeType: 'application/pdf',
      supportsFormatting: true,
      supportsMetadata: true,
      industryStandard: true
    });

    this.formatTemplates.set('epub', {
      name: 'Electronic Publication',
      description: 'Standard e-book format',
      fileExtension: '.epub',
      mimeType: 'application/epub+zip',
      supportsFormatting: true,
      supportsMetadata: true,
      industryStandard: true
    });

    this.formatTemplates.set('mobi', {
      name: 'Mobipocket',
      description: 'Amazon Kindle format',
      fileExtension: '.mobi',
      mimeType: 'application/x-mobipocket-ebook',
      supportsFormatting: true,
      supportsMetadata: true,
      industryStandard: true
    });

    // Screenplay formats
    this.formatTemplates.set('fdx', {
      name: 'Final Draft',
      description: 'Industry standard screenplay format',
      fileExtension: '.fdx',
      mimeType: 'application/xml',
      supportsFormatting: true,
      supportsMetadata: true,
      industryStandard: true
    });

    this.formatTemplates.set('fountain', {
      name: 'Fountain',
      description: 'Plain text screenplay format',
      fileExtension: '.fountain',
      mimeType: 'text/plain',
      supportsFormatting: false,
      supportsMetadata: false,
      industryStandard: true
    });

    // Plain text formats
    this.formatTemplates.set('txt', {
      name: 'Plain Text',
      description: 'Simple text format',
      fileExtension: '.txt',
      mimeType: 'text/plain',
      supportsFormatting: false,
      supportsMetadata: false,
      industryStandard: false
    });

    this.formatTemplates.set('markdown', {
      name: 'Markdown',
      description: 'Formatted plain text',
      fileExtension: '.md',
      mimeType: 'text/markdown',
      supportsFormatting: true,
      supportsMetadata: false,
      industryStandard: false
    });

    // Web formats
    this.formatTemplates.set('html', {
      name: 'HTML Document',
      description: 'Web-ready format',
      fileExtension: '.html',
      mimeType: 'text/html',
      supportsFormatting: true,
      supportsMetadata: true,
      industryStandard: false
    });

    // Specialized formats
    this.formatTemplates.set('rtf', {
      name: 'Rich Text Format',
      description: 'Cross-platform formatted text',
      fileExtension: '.rtf',
      mimeType: 'application/rtf',
      supportsFormatting: true,
      supportsMetadata: false,
      industryStandard: true
    });
  }

  async exportStory(story: Story, config: ExportConfiguration): Promise<ExportResult> {
    const template = this.formatTemplates.get(config.format);
    if (!template) {
      throw new Error(`Unsupported export format: ${config.format}`);
    }

    // Prepare story content
    const content = await this.prepareContent(story, config);
    
    // Generate metadata
    const metadata = await this.generateMetadata(story, config);
    
    // Apply formatting
    const formattedContent = await this.applyFormatting(content, config, template);
    
    // Write to file
    const outputPath = await this.writeToFile(formattedContent, config, template);
    
    // Calculate statistics
    const statistics = this.calculateStatistics(story, formattedContent);

    return {
      success: true,
      outputPath,
      format: config.format,
      fileSize: await this.getFileSize(outputPath),
      statistics,
      metadata,
      warnings: []
    };
  }

  private async prepareContent(story: Story, config: ExportConfiguration): Promise<string> {
    let content = '';
    
    // Add title page if requested
    if (config.options.includeTitlePage) {
      content += await this.generateTitlePage(story, config);
    }
    
    // Add table of contents if requested
    if (config.options.includeTableOfContents) {
      content += await this.generateTableOfContents(story, config);
    }
    
    // Process scenes
    const scenes = story.scenes || [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      
      // Add chapter breaks if configured
      if (config.options.chapterBreaks && this.isChapterBreak(scene, i, config)) {
        content += await this.generateChapterBreak(scene, i, config);
      }
      
      // Add scene content
      content += await this.processSceneContent(scene, config);
      
      // Add scene separator if not last scene
      if (i < scenes.length - 1) {
        content += this.getSceneSeparator(config);
      }
    }
    
    // Add appendices if requested
    if (config.options.includeCharacterList) {
      content += await this.generateCharacterList(story, config);
    }
    
    return content;
  }

  private async generateTitlePage(story: Story, config: ExportConfiguration): Promise<string> {
    const template = this.formatTemplates.get(config.format)!;
    
    let titlePage = '';
    
    if (template.supportsFormatting) {
      titlePage += this.formatTitle(story.title, config.format);
      titlePage += '\n\n';
      
      if (story.author) {
        titlePage += this.formatAuthor(story.author, config.format);
        titlePage += '\n\n';
      }
      
      if (story.genre) {
        titlePage += this.formatGenre(story.genre, config.format);
        titlePage += '\n\n';
      }
      
      // Add word count
      const wordCount = this.calculateWordCount(story);
      titlePage += this.formatWordCount(wordCount, config.format);
      titlePage += '\n\n';
      
      titlePage += this.formatPageBreak(config.format);
    } else {
      titlePage += `${story.title}\n`;
      titlePage += `by ${story.author || 'Unknown Author'}\n\n`;
      titlePage += `Genre: ${story.genre || 'Unknown'}\n`;
      titlePage += `Word Count: ${this.calculateWordCount(story)}\n\n`;
      titlePage += '=' .repeat(50) + '\n\n';
    }
    
    return titlePage;
  }

  private async generateTableOfContents(story: Story, config: ExportConfiguration): Promise<string> {
    const scenes = story.scenes || [];
    let toc = '';
    
    if (this.formatTemplates.get(config.format)!.supportsFormatting) {
      toc += this.formatHeading('Table of Contents', 1, config.format);
      toc += '\n\n';
    } else {
      toc += 'TABLE OF CONTENTS\n\n';
    }
    
    let chapterNumber = 1;
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      
      if (this.isChapterBreak(scene, i, config)) {
        const chapterTitle = scene.title || `Chapter ${chapterNumber}`;
        
        if (this.formatTemplates.get(config.format)!.supportsFormatting) {
          toc += this.formatTOCEntry(chapterTitle, chapterNumber, config.format);
        } else {
          toc += `${chapterNumber}. ${chapterTitle}\n`;
        }
        
        chapterNumber++;
      }
    }
    
    toc += this.formatPageBreak(config.format);
    return toc;
  }

  private isChapterBreak(scene: Scene, index: number, config: ExportConfiguration): boolean {
    // First scene is always a chapter break
    if (index === 0) return true;
    
    // Check if scene is marked as chapter break
    if (scene.isChapterBreak) return true;
    
    // Check automatic chapter break rules
    if (config.options.chapterBreaks) {
      const breakInterval = config.options.scenesPerChapter || 5;
      return index % breakInterval === 0;
    }
    
    return false;
  }

  private async generateChapterBreak(scene: Scene, index: number, config: ExportConfiguration): Promise<string> {
    const chapterNumber = Math.floor(index / (config.options.scenesPerChapter || 5)) + 1;
    const chapterTitle = scene.title || `Chapter ${chapterNumber}`;
    
    let chapterBreak = '';
    
    if (this.formatTemplates.get(config.format)!.supportsFormatting) {
      chapterBreak += this.formatPageBreak(config.format);
      chapterBreak += this.formatHeading(chapterTitle, 1, config.format);
      chapterBreak += '\n\n';
    } else {
      chapterBreak += '\n\n' + '='.repeat(50) + '\n';
      chapterBreak += chapterTitle.toUpperCase() + '\n';
      chapterBreak += '='.repeat(50) + '\n\n';
    }
    
    return chapterBreak;
  }

  private async processSceneContent(scene: Scene, config: ExportConfiguration): Promise<string> {
    let content = scene.content || '';
    
    // Apply text processing options
    if (config.options.removeExtraSpaces) {
      content = content.replace(/\s+/g, ' ').trim();
    }
    
    if (config.options.standardizePunctuation) {
      content = this.standardizePunctuation(content);
    }
    
    // Apply paragraph formatting
    if (config.options.indentParagraphs) {
      content = this.indentParagraphs(content, config.format);
    }
    
    // Apply dialogue formatting
    if (config.options.formatDialogue) {
      content = await this.formatDialogue(content, config.format);
    }
    
    return content + '\n\n';
  }

  private standardizePunctuation(content: string): string {
    // Replace smart quotes with straight quotes
    content = content.replace(/[""]/g, '"');
    content = content.replace(/['']/g, "'");
    
    // Standardize ellipses
    content = content.replace(/\.{3,}/g, '...');
    
    // Standardize em dashes
    content = content.replace(/--+/g, '—');
    
    // Fix spacing around punctuation
    content = content.replace(/\s+([.!?])/g, '$1');
    content = content.replace(/([.!?])\s+/g, '$1 ');
    
    return content;
  }

  private indentParagraphs(content: string, format: ExportFormat): string {
    const paragraphs = content.split('\n\n');
    
    if (format === 'html') {
      return paragraphs.map(p => `<p style="text-indent: 1.5em;">${p}</p>`).join('\n');
    } else if (format === 'markdown') {
      return paragraphs.map(p => `    ${p}`).join('\n\n');
    } else {
      return paragraphs.map(p => `    ${p}`).join('\n\n');
    }
  }

  private async formatDialogue(content: string, format: ExportFormat): Promise<string> {
    // Simple dialogue formatting - in a real implementation, this would be more sophisticated
    if (format === 'html') {
      content = content.replace(/"([^"]+)"/g, '<span class="dialogue">"$1"</span>');
    }
    
    return content;
  }

  private getSceneSeparator(config: ExportConfiguration): string {
    const format = config.format;
    
    if (config.options.sceneBreaks) {
      if (format === 'html') {
        return '<hr class="scene-break" />\n\n';
      } else if (format === 'markdown') {
        return '\n---\n\n';
      } else {
        return '\n* * *\n\n';
      }
    }
    
    return '\n\n';
  }

  private async generateCharacterList(story: Story, config: ExportConfiguration): Promise<string> {
    const characters = story.characters || [];
    let characterList = '';
    
    if (this.formatTemplates.get(config.format)!.supportsFormatting) {
      characterList += this.formatPageBreak(config.format);
      characterList += this.formatHeading('Characters', 1, config.format);
      characterList += '\n\n';
    } else {
      characterList += '\n\n' + '='.repeat(50) + '\n';
      characterList += 'CHARACTERS\n';
      characterList += '='.repeat(50) + '\n\n';
    }
    
    for (const character of characters) {
      if (this.formatTemplates.get(config.format)!.supportsFormatting) {
        characterList += this.formatHeading(character.name, 2, config.format);
        characterList += '\n';
        characterList += character.description || 'No description available.';
        characterList += '\n\n';
      } else {
        characterList += `${character.name.toUpperCase()}\n`;
        characterList += character.description || 'No description available.';
        characterList += '\n\n';
      }
    }
    
    return characterList;
  }

  private async generateMetadata(story: Story, config: ExportConfiguration): Promise<PublishingMetadata> {
    const wordCount = this.calculateWordCount(story);
    const pageCount = Math.ceil(wordCount / 250); // Approximate pages
    
    return {
      title: story.title,
      author: story.author || 'Unknown Author',
      genre: story.genre || 'Fiction',
      wordCount,
      pageCount,
      copyright: `© ${new Date().getFullYear()} ${story.author || 'Unknown Author'}`,
      description: story.summary || 'No description available.',
      keywords: this.extractKeywords(story)
    };
  }

  private extractKeywords(story: Story): string[] {
    const keywords: string[] = [];
    
    if (story.genre) keywords.push(story.genre);
    if (story.setting) keywords.push(story.setting);
    
    // Extract keywords from content (simplified)
    const allContent = (story.scenes || [])
      .map(scene => scene.content || '')
      .join(' ')
      .toLowerCase();
    
    const commonWords = ['adventure', 'mystery', 'romance', 'fantasy', 'science fiction', 'thriller', 'drama'];
    for (const word of commonWords) {
      if (allContent.includes(word)) {
        keywords.push(word);
      }
    }
    
    return [...new Set(keywords)].slice(0, 10);
  }

  private async applyFormatting(content: string, config: ExportConfiguration, template: FormatTemplate): Promise<string> {
    if (!template.supportsFormatting) {
      return content;
    }
    
    switch (config.format) {
      case 'html':
        return this.formatAsHTML(content, config);
      case 'markdown':
        return this.formatAsMarkdown(content, config);
      case 'rtf':
        return this.formatAsRTF(content, config);
      default:
        return content;
    }
  }

  private formatAsHTML(content: string, config: ExportConfiguration): string {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.options.title || 'Exported Story'}</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.6;
            max-width: 8.5in;
            margin: 0 auto;
            padding: 1in;
        }
        .title { text-align: center; font-size: 18pt; font-weight: bold; }
        .author { text-align: center; font-size: 14pt; margin-top: 1em; }
        .chapter { page-break-before: always; font-size: 16pt; font-weight: bold; text-align: center; margin: 2em 0; }
        .scene-break { border: none; text-align: center; margin: 2em 0; }
        .scene-break::before { content: "* * *"; }
        .dialogue { font-style: italic; }
        p { text-indent: 1.5em; margin: 0; }
        p + p { margin-top: 1em; }
    </style>
</head>
<body>
${content}
</body>
</html>`;
    
    return html;
  }

  private formatAsMarkdown(content: string, config: ExportConfiguration): string {
    // Add YAML front matter
    let markdown = '---\n';
    markdown += `title: "${config.options.title || 'Exported Story'}"\n`;
    markdown += `author: "${config.options.author || 'Unknown Author'}"\n`;
    markdown += `date: "${new Date().toISOString().split('T')[0]}"\n`;
    markdown += '---\n\n';
    
    markdown += content;
    
    return markdown;
  }

  private formatAsRTF(content: string, config: ExportConfiguration): string {
    // Basic RTF formatting
    let rtf = '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}';
    rtf += '\\f0\\fs24 '; // 12pt font
    
    // Convert content to RTF
    content = content.replace(/\n/g, '\\par ');
    content = content.replace(/\t/g, '\\tab ');
    
    rtf += content;
    rtf += '}';
    
    return rtf;
  }

  private formatTitle(title: string, format: ExportFormat): string {
    switch (format) {
      case 'html':
        return `<h1 class="title">${title}</h1>`;
      case 'markdown':
        return `# ${title}`;
      default:
        return title.toUpperCase();
    }
  }

  private formatAuthor(author: string, format: ExportFormat): string {
    switch (format) {
      case 'html':
        return `<p class="author">by ${author}</p>`;
      case 'markdown':
        return `*by ${author}*`;
      default:
        return `by ${author}`;
    }
  }

  private formatGenre(genre: string, format: ExportFormat): string {
    switch (format) {
      case 'html':
        return `<p class="genre">${genre}</p>`;
      case 'markdown':
        return `**Genre:** ${genre}`;
      default:
        return `Genre: ${genre}`;
    }
  }

  private formatWordCount(wordCount: number, format: ExportFormat): string {
    switch (format) {
      case 'html':
        return `<p class="word-count">Word Count: ${wordCount.toLocaleString()}</p>`;
      case 'markdown':
        return `**Word Count:** ${wordCount.toLocaleString()}`;
      default:
        return `Word Count: ${wordCount.toLocaleString()}`;
    }
  }

  private formatHeading(text: string, level: number, format: ExportFormat): string {
    switch (format) {
      case 'html':
        return `<h${level} class="heading-${level}">${text}</h${level}>`;
      case 'markdown':
        return '#'.repeat(level) + ' ' + text;
      default:
        return text.toUpperCase();
    }
  }

  private formatPageBreak(format: ExportFormat): string {
    switch (format) {
      case 'html':
        return '<div style="page-break-before: always;"></div>\n';
      case 'markdown':
        return '\n\\newpage\n\n';
      default:
        return '\n\n' + '='.repeat(50) + '\n\n';
    }
  }

  private formatTOCEntry(title: string, number: number, format: ExportFormat): string {
    switch (format) {
      case 'html':
        return `<p class="toc-entry"><a href="#chapter-${number}">${number}. ${title}</a></p>\n`;
      case 'markdown':
        return `${number}. [${title}](#chapter-${number})\n`;
      default:
        return `${number}. ${title}\n`;
    }
  }

  private async writeToFile(content: string, config: ExportConfiguration, template: FormatTemplate): Promise<string> {
    const fileName = this.generateFileName(config, template);
    const fullPath = path.join(config.outputPath, fileName);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    // Write file
    await fs.writeFile(fullPath, content, 'utf-8');
    
    return fullPath;
  }

  private generateFileName(config: ExportConfiguration, template: FormatTemplate): string {
    const baseName = config.options.fileName || 'exported-story';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    
    return `${baseName}-${timestamp}${template.fileExtension}`;
  }

  private calculateStatistics(story: Story, content: string): any {
    const wordCount = this.calculateWordCount(story);
    const characterCount = content.length;
    const paragraphCount = content.split('\n\n').length;
    const pageCount = Math.ceil(wordCount / 250);
    
    return {
      wordCount,
      characterCount,
      paragraphCount,
      pageCount,
      sceneCount: story.scenes?.length || 0,
      characterListCount: story.characters?.length || 0
    };
  }

  private calculateWordCount(story: Story): number {
    const scenes = story.scenes || [];
    let totalWords = 0;
    
    for (const scene of scenes) {
      const content = scene.content || '';
      const words = content.split(/\s+/).filter(word => word.length > 0);
      totalWords += words.length;
    }
    
    return totalWords;
  }

  private async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  // Query letter and synopsis generation
  async generateQueryLetter(story: Story, data: QueryLetterData): Promise<string> {
    const provider = await this.aiRegistry.getProvider('cowriter');
    
    const prompt = `Generate a professional query letter for a ${data.genre} novel with the following information:

Book Title: ${data.bookTitle}
Genre: ${data.genre}
Word Count: ${data.wordCount.toLocaleString()}
Logline: ${data.logline}

Synopsis: ${data.synopsis}

Author Bio: ${data.authorBio}
Credentials: ${data.credentials.join(', ')}
Comparable Titles: ${data.comparableTitles.join(', ')}

Write a compelling query letter following industry standards:
1. Hook paragraph with logline
2. Synopsis paragraph (2-3 sentences)
3. Bio paragraph with credentials
4. Closing with word count and genre

Keep it to one page (250-300 words).`;

    const response = await provider.generateText({
      prompt,
      maxTokens: 400,
      temperature: 0.7,
      systemPrompt: 'You are a professional literary agent assistant who writes compelling query letters that follow industry standards and best practices.'
    });

    return response.text;
  }

  async generateSynopsis(story: Story, data: SynopsisData): Promise<string> {
    const provider = await this.aiRegistry.getProvider('cowriter');
    
    const scenes = story.scenes || [];
    const plotSummary = scenes.slice(0, 5).map(scene => 
      scene.content?.substring(0, 200) + '...'
    ).join('\n\n');

    const prompt = `Generate a professional synopsis for a ${data.genre} novel:

Title: ${data.title}
Genre: ${data.genre}
Word Count: ${data.wordCount.toLocaleString()}
Target Audience: ${data.targetAudience}

Main Characters: ${data.mainCharacters.join(', ')}
Themes: ${data.themes.join(', ')}

Plot Summary: ${data.plotSummary}

Key Scenes:
${plotSummary}

Write a 1-2 page synopsis that:
1. Summarizes the entire plot including the ending
2. Focuses on main character arcs and conflicts
3. Highlights key themes and genre elements
4. Uses present tense and third person
5. Reveals all major plot points and twists

Target length: 500-750 words.`;

    const response = await provider.generateText({
      prompt,
      maxTokens: 800,
      temperature: 0.6,
      systemPrompt: 'You are a professional publishing industry expert who writes compelling synopses that effectively summarize novels for agents and editors.'
    });

    return response.text;
  }

  // Style guide compliance
  async checkStyleCompliance(story: Story, styleGuide: 'chicago' | 'mla' | 'apa' | 'industry'): Promise<{
    compliant: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    const wordCount = this.calculateWordCount(story);
    const scenes = story.scenes || [];
    
    // Check word count requirements
    if (styleGuide === 'industry') {
      if (wordCount < 70000) {
        issues.push('Word count below industry minimum (70,000 words)');
        suggestions.push('Consider expanding scenes or adding subplots');
      } else if (wordCount > 120000) {
        issues.push('Word count above industry maximum (120,000 words)');
        suggestions.push('Consider trimming unnecessary scenes or descriptions');
      }
    }
    
    // Check formatting consistency
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const content = scene.content || '';
      
      // Check paragraph structure
      if (content.includes('\t')) {
        issues.push(`Scene ${i + 1}: Contains tab characters (use spaces for indentation)`);
      }
      
      // Check dialogue formatting
      const dialogueIssues = this.checkDialogueFormatting(content);
      if (dialogueIssues.length > 0) {
        issues.push(`Scene ${i + 1}: ${dialogueIssues.join(', ')}`);
      }
      
      // Check punctuation
      const punctuationIssues = this.checkPunctuation(content, styleGuide);
      if (punctuationIssues.length > 0) {
        issues.push(`Scene ${i + 1}: ${punctuationIssues.join(', ')}`);
      }
    }
    
    // Generate suggestions based on style guide
    if (styleGuide === 'chicago') {
      suggestions.push('Use Chicago Manual of Style formatting for citations');
      suggestions.push('Use serial commas consistently');
    } else if (styleGuide === 'industry') {
      suggestions.push('Use standard manuscript format (12pt Times New Roman, double-spaced)');
      suggestions.push('Include proper headers with title and page numbers');
    }
    
    return {
      compliant: issues.length === 0,
      issues,
      suggestions
    };
  }

  private checkDialogueFormatting(content: string): string[] {
    const issues: string[] = [];
    
    // Check for proper quote usage
    if (content.includes('"') && content.includes('"')) {
      issues.push('Mixed quote styles (use consistent straight or smart quotes)');
    }
    
    // Check for dialogue punctuation
    const dialoguePattern = /"[^"]*"/g;
    const dialogues = content.match(dialoguePattern) || [];
    
    for (const dialogue of dialogues) {
      if (!dialogue.match(/[.!?]"/)) {
        issues.push('Dialogue missing ending punctuation');
      }
    }
    
    return issues;
  }

  private checkPunctuation(content: string, styleGuide: string): string[] {
    const issues: string[] = [];
    
    // Check for double spaces
    if (content.includes('  ')) {
      issues.push('Contains double spaces');
    }
    
    // Check for proper ellipses
    if (content.includes('....') || content.includes('..')) {
      issues.push('Improper ellipses formatting (use three dots)');
    }
    
    // Style-specific checks
    if (styleGuide === 'chicago') {
      // Check for serial comma usage
      const commaPattern = /,\s+and\s+/g;
      if (!commaPattern.test(content)) {
        issues.push('Consider using serial commas (Chicago style)');
      }
    }
    
    return issues;
  }

  // Public API methods
  async getAvailableFormats(): Promise<FormatTemplate[]> {
    return Array.from(this.formatTemplates.values());
  }

  async validateExportConfiguration(config: ExportConfiguration): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    if (!this.formatTemplates.has(config.format)) {
      errors.push(`Unsupported format: ${config.format}`);
    }
    
    if (!config.outputPath) {
      errors.push('Output path is required');
    }
    
    if (config.options.chapterBreaks && (!config.options.scenesPerChapter || config.options.scenesPerChapter < 1)) {
      errors.push('Scenes per chapter must be specified when using chapter breaks');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  async estimateExportTime(story: Story, format: ExportFormat): Promise<number> {
    const wordCount = this.calculateWordCount(story);
    const sceneCount = story.scenes?.length || 0;
    
    // Base time estimates in seconds
    let baseTime = 5; // Base processing time
    
    // Add time based on word count
    baseTime += Math.ceil(wordCount / 10000) * 2;
    
    // Add time based on scene count
    baseTime += sceneCount * 0.5;
    
    // Format-specific multipliers
    const formatMultipliers: { [key in ExportFormat]?: number } = {
      'pdf': 2.0,
      'epub': 1.8,
      'docx': 1.5,
      'html': 1.2,
      'txt': 0.8
    };
    
    const multiplier = formatMultipliers[format] || 1.0;
    
    return Math.ceil(baseTime * multiplier);
  }
}