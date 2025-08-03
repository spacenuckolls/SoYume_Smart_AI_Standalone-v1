import { 
  Story, 
  Character, 
  Chapter, 
  Scene, 
  StoryStructure, 
  CharacterTraits,
  Relationship,
  Setting,
  Mood,
  ScenePurpose,
  StoryMetadata
} from '../types/Story';

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

// Story validation
export class StoryValidator {
  static validate(story: Partial<Story>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields validation
    if (!story.id || story.id.trim() === '') {
      errors.push({
        field: 'id',
        message: 'Story ID is required',
        code: 'STORY_ID_REQUIRED'
      });
    }

    if (!story.title || story.title.trim() === '') {
      errors.push({
        field: 'title',
        message: 'Story title is required',
        code: 'STORY_TITLE_REQUIRED'
      });
    }

    // Title length validation
    if (story.title && story.title.length > 200) {
      errors.push({
        field: 'title',
        message: 'Story title must be 200 characters or less',
        code: 'STORY_TITLE_TOO_LONG'
      });
    }

    // Genre validation
    if (!story.genre || story.genre.length === 0) {
      warnings.push({
        field: 'genre',
        message: 'Consider adding at least one genre to help categorize your story',
        code: 'STORY_GENRE_MISSING'
      });
    }

    // Structure validation
    if (story.structure) {
      const structureValidation = this.validateStructure(story.structure);
      errors.push(...structureValidation.errors);
      warnings.push(...structureValidation.warnings);
    }

    // Characters validation
    if (story.characters) {
      story.characters.forEach((character, index) => {
        const characterValidation = CharacterValidator.validate(character);
        errors.push(...characterValidation.errors.map(err => ({
          ...err,
          field: `characters[${index}].${err.field}`
        })));
        warnings.push(...characterValidation.warnings.map(warn => ({
          ...warn,
          field: `characters[${index}].${warn.field}`
        })));
      });
    }

    // Chapters validation
    if (story.chapters) {
      story.chapters.forEach((chapter, index) => {
        const chapterValidation = ChapterValidator.validate(chapter);
        errors.push(...chapterValidation.errors.map(err => ({
          ...err,
          field: `chapters[${index}].${err.field}`
        })));
        warnings.push(...chapterValidation.warnings.map(warn => ({
          ...warn,
          field: `chapters[${index}].${warn.field}`
        })));
      });

      // Check chapter order consistency
      const orders = story.chapters.map(c => c.order).sort((a, b) => a - b);
      for (let i = 0; i < orders.length; i++) {
        if (orders[i] !== i + 1) {
          errors.push({
            field: 'chapters',
            message: `Chapter order is inconsistent. Expected ${i + 1}, found ${orders[i]}`,
            code: 'CHAPTER_ORDER_INCONSISTENT'
          });
          break;
        }
      }
    }

    // Metadata validation
    if (story.metadata) {
      const metadataValidation = this.validateMetadata(story.metadata);
      errors.push(...metadataValidation.errors);
      warnings.push(...metadataValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private static validateStructure(structure: StoryStructure): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate structure type
    const validTypes = ['save-the-cat', 'hero-journey', 'three-act', 'monogatari', 'custom'];
    if (!validTypes.includes(structure.type)) {
      errors.push({
        field: 'structure.type',
        message: `Invalid structure type. Must be one of: ${validTypes.join(', ')}`,
        code: 'INVALID_STRUCTURE_TYPE'
      });
    }

    // Validate beats
    if (!structure.beats || structure.beats.length === 0) {
      warnings.push({
        field: 'structure.beats',
        message: 'Consider defining story beats to track narrative progress',
        code: 'STRUCTURE_BEATS_MISSING'
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static validateMetadata(metadata: StoryMetadata): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Target word count validation
    if (metadata.targetWordCount <= 0) {
      errors.push({
        field: 'metadata.targetWordCount',
        message: 'Target word count must be greater than 0',
        code: 'INVALID_TARGET_WORD_COUNT'
      });
    }

    if (metadata.targetWordCount > 0 && metadata.targetWordCount < 1000) {
      warnings.push({
        field: 'metadata.targetWordCount',
        message: 'Target word count seems low for a typical story',
        code: 'LOW_TARGET_WORD_COUNT'
      });
    }

    // Current word count validation
    if (metadata.currentWordCount < 0) {
      errors.push({
        field: 'metadata.currentWordCount',
        message: 'Current word count cannot be negative',
        code: 'NEGATIVE_CURRENT_WORD_COUNT'
      });
    }

    // Target audience validation
    if (!metadata.targetAudience || metadata.targetAudience.trim() === '') {
      warnings.push({
        field: 'metadata.targetAudience',
        message: 'Consider specifying a target audience for better story focus',
        code: 'TARGET_AUDIENCE_MISSING'
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}

// Character validation
export class CharacterValidator {
  static validate(character: Partial<Character>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields
    if (!character.id || character.id.trim() === '') {
      errors.push({
        field: 'id',
        message: 'Character ID is required',
        code: 'CHARACTER_ID_REQUIRED'
      });
    }

    if (!character.name || character.name.trim() === '') {
      errors.push({
        field: 'name',
        message: 'Character name is required',
        code: 'CHARACTER_NAME_REQUIRED'
      });
    }

    // Name length validation
    if (character.name && character.name.length > 100) {
      errors.push({
        field: 'name',
        message: 'Character name must be 100 characters or less',
        code: 'CHARACTER_NAME_TOO_LONG'
      });
    }

    // Traits validation
    if (character.traits) {
      const traitsValidation = this.validateTraits(character.traits);
      errors.push(...traitsValidation.errors);
      warnings.push(...traitsValidation.warnings);
    }

    // Relationships validation
    if (character.relationships) {
      character.relationships.forEach((relationship, index) => {
        const relationshipValidation = this.validateRelationship(relationship);
        errors.push(...relationshipValidation.errors.map(err => ({
          ...err,
          field: `relationships[${index}].${err.field}`
        })));
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static validateTraits(traits: CharacterTraits): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for empty trait arrays
    if (!traits.personality || traits.personality.length === 0) {
      warnings.push({
        field: 'traits.personality',
        message: 'Consider adding personality traits to develop the character',
        code: 'PERSONALITY_TRAITS_MISSING'
      });
    }

    if (!traits.motivations || traits.motivations.length === 0) {
      warnings.push({
        field: 'traits.motivations',
        message: 'Character motivations help drive the story forward',
        code: 'MOTIVATIONS_MISSING'
      });
    }

    // Check for balanced traits
    const totalPositive = (traits.strengths?.length || 0);
    const totalNegative = (traits.weaknesses?.length || 0) + (traits.fears?.length || 0);

    if (totalPositive > 0 && totalNegative === 0) {
      warnings.push({
        field: 'traits',
        message: 'Consider adding weaknesses or fears to create a more balanced character',
        code: 'CHARACTER_TOO_PERFECT'
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static validateRelationship(relationship: Relationship): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields
    if (!relationship.characterId || relationship.characterId.trim() === '') {
      errors.push({
        field: 'characterId',
        message: 'Related character ID is required',
        code: 'RELATIONSHIP_CHARACTER_ID_REQUIRED'
      });
    }

    // Intensity validation
    if (relationship.intensity < 1 || relationship.intensity > 10) {
      errors.push({
        field: 'intensity',
        message: 'Relationship intensity must be between 1 and 10',
        code: 'INVALID_RELATIONSHIP_INTENSITY'
      });
    }

    // Type validation
    const validTypes = ['romantic', 'friendship', 'family', 'rivalry', 'mentor-student', 'enemy', 'ally', 'neutral'];
    if (!validTypes.includes(relationship.type)) {
      errors.push({
        field: 'type',
        message: `Invalid relationship type. Must be one of: ${validTypes.join(', ')}`,
        code: 'INVALID_RELATIONSHIP_TYPE'
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}

// Chapter validation
export class ChapterValidator {
  static validate(chapter: Partial<Chapter>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields
    if (!chapter.id || chapter.id.trim() === '') {
      errors.push({
        field: 'id',
        message: 'Chapter ID is required',
        code: 'CHAPTER_ID_REQUIRED'
      });
    }

    if (!chapter.storyId || chapter.storyId.trim() === '') {
      errors.push({
        field: 'storyId',
        message: 'Story ID is required',
        code: 'CHAPTER_STORY_ID_REQUIRED'
      });
    }

    if (!chapter.title || chapter.title.trim() === '') {
      errors.push({
        field: 'title',
        message: 'Chapter title is required',
        code: 'CHAPTER_TITLE_REQUIRED'
      });
    }

    // Order validation
    if (chapter.order !== undefined && chapter.order < 1) {
      errors.push({
        field: 'order',
        message: 'Chapter order must be 1 or greater',
        code: 'INVALID_CHAPTER_ORDER'
      });
    }

    // Word count validation
    if (chapter.wordCount !== undefined && chapter.wordCount < 0) {
      errors.push({
        field: 'wordCount',
        message: 'Word count cannot be negative',
        code: 'NEGATIVE_WORD_COUNT'
      });
    }

    // Content validation
    if (chapter.content && chapter.content.trim() === '') {
      warnings.push({
        field: 'content',
        message: 'Chapter appears to be empty',
        code: 'EMPTY_CHAPTER_CONTENT'
      });
    }

    // Scenes validation
    if (chapter.scenes) {
      chapter.scenes.forEach((scene, index) => {
        const sceneValidation = SceneValidator.validate(scene);
        errors.push(...sceneValidation.errors.map(err => ({
          ...err,
          field: `scenes[${index}].${err.field}`
        })));
        warnings.push(...sceneValidation.warnings.map(warn => ({
          ...warn,
          field: `scenes[${index}].${warn.field}`
        })));
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}

// Scene validation
export class SceneValidator {
  static validate(scene: Partial<Scene>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields
    if (!scene.id || scene.id.trim() === '') {
      errors.push({
        field: 'id',
        message: 'Scene ID is required',
        code: 'SCENE_ID_REQUIRED'
      });
    }

    if (!scene.chapterId || scene.chapterId.trim() === '') {
      errors.push({
        field: 'chapterId',
        message: 'Chapter ID is required',
        code: 'SCENE_CHAPTER_ID_REQUIRED'
      });
    }

    // Order validation
    if (scene.order !== undefined && scene.order < 1) {
      errors.push({
        field: 'order',
        message: 'Scene order must be 1 or greater',
        code: 'INVALID_SCENE_ORDER'
      });
    }

    // Setting validation
    if (scene.setting) {
      const settingValidation = this.validateSetting(scene.setting);
      errors.push(...settingValidation.errors);
      warnings.push(...settingValidation.warnings);
    }

    // Characters validation
    if (!scene.characters || scene.characters.length === 0) {
      warnings.push({
        field: 'characters',
        message: 'Consider adding characters to make the scene more engaging',
        code: 'SCENE_CHARACTERS_MISSING'
      });
    }

    // Mood validation
    if (scene.mood) {
      const moodValidation = this.validateMood(scene.mood);
      errors.push(...moodValidation.errors);
      warnings.push(...moodValidation.warnings);
    }

    // Purpose validation
    if (scene.purpose) {
      const purposeValidation = this.validatePurpose(scene.purpose);
      errors.push(...purposeValidation.errors);
      warnings.push(...purposeValidation.warnings);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static validateSetting(setting: Setting): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!setting.location || setting.location.trim() === '') {
      warnings.push({
        field: 'setting.location',
        message: 'Consider specifying a location for better scene visualization',
        code: 'SETTING_LOCATION_MISSING'
      });
    }

    if (!setting.timeOfDay || setting.timeOfDay.trim() === '') {
      warnings.push({
        field: 'setting.timeOfDay',
        message: 'Time of day can help establish scene atmosphere',
        code: 'SETTING_TIME_MISSING'
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static validateMood(mood: Mood): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!mood.primary || mood.primary.trim() === '') {
      warnings.push({
        field: 'mood.primary',
        message: 'Primary mood helps establish scene tone',
        code: 'MOOD_PRIMARY_MISSING'
      });
    }

    if (mood.intensity < 1 || mood.intensity > 10) {
      errors.push({
        field: 'mood.intensity',
        message: 'Mood intensity must be between 1 and 10',
        code: 'INVALID_MOOD_INTENSITY'
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static validatePurpose(purpose: ScenePurpose): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const validTypes = ['plot', 'character', 'world-building', 'transition', 'climax'];
    if (!validTypes.includes(purpose.type)) {
      errors.push({
        field: 'purpose.type',
        message: `Invalid scene purpose type. Must be one of: ${validTypes.join(', ')}`,
        code: 'INVALID_SCENE_PURPOSE_TYPE'
      });
    }

    if (!purpose.description || purpose.description.trim() === '') {
      warnings.push({
        field: 'purpose.description',
        message: 'Scene purpose description helps maintain narrative focus',
        code: 'SCENE_PURPOSE_DESCRIPTION_MISSING'
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}