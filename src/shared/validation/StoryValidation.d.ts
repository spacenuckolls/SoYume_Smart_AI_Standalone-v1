import { Story, Character, Chapter, Scene } from '../types/Story';
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
export declare class StoryValidator {
    static validate(story: Partial<Story>): ValidationResult;
    private static validateStructure;
    private static validateMetadata;
}
export declare class CharacterValidator {
    static validate(character: Partial<Character>): ValidationResult;
    private static validateTraits;
    private static validateRelationship;
}
export declare class ChapterValidator {
    static validate(chapter: Partial<Chapter>): ValidationResult;
}
export declare class SceneValidator {
    static validate(scene: Partial<Scene>): ValidationResult;
    private static validateSetting;
    private static validateMood;
    private static validatePurpose;
}
//# sourceMappingURL=StoryValidation.d.ts.map