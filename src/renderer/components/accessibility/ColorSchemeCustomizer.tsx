import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AccessibilityManager } from '../../../main/accessibility/AccessibilityManager';

export interface ColorScheme {
  id: string;
  name: string;
  description: string;
  type: 'light' | 'dark' | 'high-contrast' | 'custom';
  colors: ColorPalette;
  accessibility: AccessibilityFeatures;
  isDefault?: boolean;
  isUserCreated?: boolean;
}

export interface ColorPalette {
  // Background colors
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
    overlay: string;
    modal: string;
    tooltip: string;
  };
  
  // Text colors
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    inverse: string;
    link: string;
    linkHover: string;
  };
  
  // UI element colors
  ui: {
    border: string;
    borderLight: string;
    borderHeavy: string;
    focus: string;
    hover: string;
    active: string;
    selected: string;
    disabled: string;
  };
  
  // Semantic colors
  semantic: {
    success: string;
    warning: string;
    error: string;
    info: string;
    successBg: string;
    warningBg: string;
    errorBg: string;
    infoBg: string;
  };
  
  // Brand colors
  brand: {
    primary: string;
    secondary: string;
    accent: string;
    gradient: string[];
  };
  
  // Editor specific colors
  editor: {
    background: string;
    text: string;
    selection: string;
    cursor: string;
    lineNumber: string;
    gutter: string;
    highlight: string;
  };
}

export interface AccessibilityFeatures {
  contrastRatio: {
    normal: number;
    large: number;
    minimum: number;
  };
  colorBlindSupport: {
    protanopia: boolean;
    deuteranopia: boolean;
    tritanopia: boolean;
    achromatopsia: boolean;
  };
  reducedMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  focusIndicators: boolean;
}

export interface ColorSchemeCustomizerProps {
  currentScheme: ColorScheme;
  availableSchemes: ColorScheme[];
  onSchemeChange: (scheme: ColorScheme) => void;
  onSchemeCreate: (scheme: ColorScheme) => void;
  onSchemeDelete: (schemeId: string) => void;
  accessibilityMode: 'standard' | 'enhanced' | 'screen-reader';
  colorBlindnessType?: 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';
}

export const ColorSchemeCustomizer: React.FC<ColorSchemeCustomizerProps> = ({
  currentScheme,
  availableSchemes,
  onSchemeChange,
  onSchemeCreate,
  onSchemeDelete,
  accessibilityMode,
  colorBlindnessType
}) => {
  const [editingScheme, setEditingScheme] = useState<ColorScheme | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<keyof ColorPalette>('background');
  const [contrastAnalysis, setContrastAnalysis] = useState<ContrastAnalysis | null>(null);
  const [colorBlindPreview, setColorBlindPreview] = useState(false);
  const [announcements, setAnnouncements] = useState<string[]>([]);

  // Color blindness simulation
  const simulateColorBlindness = useCallback((color: string, type: string): string => {
    if (!colorBlindnessType && !colorBlindPreview) return color;
    
    const targetType = colorBlindnessType || type;
    
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    
    let newR = r, newG = g, newB = b;
    
    switch (targetType) {
      case 'protanopia': // Red-blind
        newR = 0.567 * r + 0.433 * g;
        newG = 0.558 * r + 0.442 * g;
        newB = 0.242 * g + 0.758 * b;
        break;
      case 'deuteranopia': // Green-blind
        newR = 0.625 * r + 0.375 * g;
        newG = 0.7 * r + 0.3 * g;
        newB = 0.3 * g + 0.7 * b;
        break;
      case 'tritanopia': // Blue-blind
        newR = 0.95 * r + 0.05 * g;
        newG = 0.433 * g + 0.567 * b;
        newB = 0.475 * g + 0.525 * b;
        break;
      case 'achromatopsia': // Complete color blindness
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        newR = newG = newB = gray;
        break;
    }
    
    // Convert back to hex
    const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n * 255))).toString(16).padStart(2, '0');
    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
  }, [colorBlindnessType, colorBlindPreview]);

  // Calculate contrast ratio
  const calculateContrastRatio = useCallback((color1: string, color2: string): number => {
    const getLuminance = (color: string): number => {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      
      const sRGB = [r, g, b].map(c => {
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      
      return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
    };
    
    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    
    return (brightest + 0.05) / (darkest + 0.05);
  }, []);

  // Analyze contrast for current scheme
  useEffect(() => {
    const scheme = editingScheme || currentScheme;
    const analysis: ContrastAnalysis = {
      textOnBackground: calculateContrastRatio(scheme.colors.text.primary, scheme.colors.background.primary),
      textOnSecondary: calculateContrastRatio(scheme.colors.text.primary, scheme.colors.background.secondary),
      linkOnBackground: calculateContrastRatio(scheme.colors.text.link, scheme.colors.background.primary),
      buttonContrast: calculateContrastRatio(scheme.colors.text.inverse, scheme.colors.brand.primary),
      focusContrast: calculateContrastRatio(scheme.colors.ui.focus, scheme.colors.background.primary),
      wcagAA: true,
      wcagAAA: true,
      issues: []
    };
    
    // Check WCAG compliance
    if (analysis.textOnBackground < 4.5) {
      analysis.wcagAA = false;
      analysis.issues.push('Text on background does not meet WCAG AA standards (4.5:1)');
    }
    if (analysis.textOnBackground < 7) {
      analysis.wcagAAA = false;
      analysis.issues.push('Text on background does not meet WCAG AAA standards (7:1)');
    }
    
    setContrastAnalysis(analysis);
  }, [editingScheme, currentScheme, calculateContrastRatio]);

  const announceToScreenReader = (message: string) => {
    setAnnouncements(prev => [...prev, message]);
    setTimeout(() => {
      setAnnouncements(prev => prev.slice(1));
    }, 1000);
  };

  const handleColorChange = (category: keyof ColorPalette, property: string, value: string) => {
    if (!editingScheme) return;
    
    const newScheme = {
      ...editingScheme,
      colors: {
        ...editingScheme.colors,
        [category]: {
          ...editingScheme.colors[category],
          [property]: value
        }
      }
    };
    
    setEditingScheme(newScheme);
    
    if (previewMode) {
      onSchemeChange(newScheme);
    }
    
    announceToScreenReader(`Changed ${category} ${property} to ${value}`);
  };

  const handleSchemeSelect = (scheme: ColorScheme) => {
    onSchemeChange(scheme);
    setEditingScheme(null);
    announceToScreenReader(`Applied ${scheme.name} color scheme`);
  };

  const handleCreateScheme = () => {
    if (!editingScheme) return;
    
    const newScheme = {
      ...editingScheme,
      id: `custom-${Date.now()}`,
      isUserCreated: true
    };
    
    onSchemeCreate(newScheme);
    setEditingScheme(null);
    announceToScreenReader(`Created new color scheme: ${newScheme.name}`);
  };

  const startEditing = (scheme: ColorScheme) => {
    setEditingScheme({
      ...scheme,
      id: scheme.isUserCreated ? scheme.id : `custom-${Date.now()}`,
      name: scheme.isUserCreated ? scheme.name : `${scheme.name} (Custom)`,
      isUserCreated: true
    });
    announceToScreenReader(`Started editing ${scheme.name}`);
  };

  const generateAccessiblePalette = (baseColor: string): Partial<ColorPalette> => {
    // Generate an accessible color palette from a base color
    const hsl = hexToHsl(baseColor);
    
    return {
      brand: {
        primary: baseColor,
        secondary: hslToHex(hsl.h, Math.max(0, hsl.s - 20), Math.min(100, hsl.l + 20)),
        accent: hslToHex((hsl.h + 30) % 360, hsl.s, hsl.l),
        gradient: [baseColor, hslToHex(hsl.h, hsl.s, Math.min(100, hsl.l + 30))]
      },
      ui: {
        ...currentScheme.colors.ui,
        focus: baseColor,
        active: hslToHex(hsl.h, hsl.s, Math.max(0, hsl.l - 10))
      }
    };
  };

  const renderColorPicker = (
    category: keyof ColorPalette,
    property: string,
    label: string,
    currentValue: string
  ) => {
    const displayValue = colorBlindPreview ? simulateColorBlindness(currentValue, colorBlindnessType || 'protanopia') : currentValue;
    
    return (
      <div className="color-picker-group" key={`${category}-${property}`}>
        <label htmlFor={`color-${category}-${property}`} className="color-label">
          {label}
        </label>
        
        <div className="color-input-group">
          <input
            id={`color-${category}-${property}`}
            type="color"
            value={currentValue}
            onChange={(e) => handleColorChange(category, property, e.target.value)}
            className="color-input"
            aria-describedby={`contrast-${category}-${property}`}
          />
          
          <input
            type="text"
            value={currentValue}
            onChange={(e) => handleColorChange(category, property, e.target.value)}
            className="color-text-input"
            pattern="^#[0-9A-Fa-f]{6}$"
            aria-label={`${label} hex value`}
          />
          
          <div 
            className="color-preview"
            style={{ backgroundColor: displayValue }}
            aria-hidden="true"
          />
        </div>
        
        {contrastAnalysis && category === 'text' && property === 'primary' && (
          <div 
            id={`contrast-${category}-${property}`}
            className="contrast-info"
            role="status"
          >
            Contrast ratio: {contrastAnalysis.textOnBackground.toFixed(2)}:1
            {contrastAnalysis.textOnBackground < 4.5 && (
              <span className="contrast-warning" role="alert">
                ⚠️ Below WCAG AA standard
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCategoryEditor = (category: keyof ColorPalette) => {
    if (!editingScheme) return null;
    
    const categoryColors = editingScheme.colors[category] as Record<string, any>;
    
    return (
      <div className="category-editor">
        <h3>{category.charAt(0).toUpperCase() + category.slice(1)} Colors</h3>
        
        <div className="color-grid">
          {Object.entries(categoryColors).map(([property, value]) => {
            if (Array.isArray(value)) return null; // Skip gradient arrays for now
            
            return renderColorPicker(
              category,
              property,
              property.charAt(0).toUpperCase() + property.slice(1),
              value as string
            );
          })}
        </div>
      </div>
    );
  };

  const presetSchemes = useMemo(() => [
    {
      id: 'high-contrast-light',
      name: 'High Contrast Light',
      description: 'Maximum contrast for better readability',
      type: 'high-contrast' as const,
      colors: {
        ...currentScheme.colors,
        background: { ...currentScheme.colors.background, primary: '#ffffff', secondary: '#f0f0f0' },
        text: { ...currentScheme.colors.text, primary: '#000000', secondary: '#333333' },
        ui: { ...currentScheme.colors.ui, border: '#000000', focus: '#0000ff' }
      },
      accessibility: {
        contrastRatio: { normal: 21, large: 21, minimum: 7 },
        colorBlindSupport: { protanopia: true, deuteranopia: true, tritanopia: true, achromatopsia: true },
        reducedMotion: true,
        highContrast: true,
        largeText: true,
        focusIndicators: true
      }
    },
    {
      id: 'high-contrast-dark',
      name: 'High Contrast Dark',
      description: 'Dark theme with maximum contrast',
      type: 'high-contrast' as const,
      colors: {
        ...currentScheme.colors,
        background: { ...currentScheme.colors.background, primary: '#000000', secondary: '#1a1a1a' },
        text: { ...currentScheme.colors.text, primary: '#ffffff', secondary: '#cccccc' },
        ui: { ...currentScheme.colors.ui, border: '#ffffff', focus: '#00ffff' }
      },
      accessibility: {
        contrastRatio: { normal: 21, large: 21, minimum: 7 },
        colorBlindSupport: { protanopia: true, deuteranopia: true, tritanopia: true, achromatopsia: true },
        reducedMotion: true,
        highContrast: true,
        largeText: true,
        focusIndicators: true
      }
    }
  ], [currentScheme]);

  return (
    <div className={`color-scheme-customizer ${accessibilityMode}`}>
      {/* Screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcements.map((announcement, index) => (
          <div key={index}>{announcement}</div>
        ))}
      </div>

      <div className="customizer-header">
        <h2>Color Scheme Customization</h2>
        <p>Customize colors for better accessibility and personal preference</p>
      </div>

      {/* Scheme selector */}
      <div className="scheme-selector" role="group" aria-labelledby="scheme-selector-label">
        <h3 id="scheme-selector-label">Available Schemes</h3>
        
        <div className="scheme-grid">
          {[...availableSchemes, ...presetSchemes].map(scheme => (
            <div
              key={scheme.id}
              className={`scheme-card ${currentScheme.id === scheme.id ? 'active' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => handleSchemeSelect(scheme)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSchemeSelect(scheme);
                }
              }}
              aria-label={`Apply ${scheme.name} color scheme`}
              aria-describedby={`scheme-desc-${scheme.id}`}
            >
              <div className="scheme-preview">
                <div 
                  className="preview-bg"
                  style={{ backgroundColor: scheme.colors.background.primary }}
                />
                <div 
                  className="preview-text"
                  style={{ 
                    color: scheme.colors.text.primary,
                    backgroundColor: scheme.colors.background.secondary 
                  }}
                >
                  Aa
                </div>
                <div 
                  className="preview-accent"
                  style={{ backgroundColor: scheme.colors.brand.primary }}
                />
              </div>
              
              <div className="scheme-info">
                <h4>{scheme.name}</h4>
                <p id={`scheme-desc-${scheme.id}`}>{scheme.description}</p>
                
                {scheme.accessibility.highContrast && (
                  <span className="accessibility-badge" aria-label="High contrast">
                    🔍 High Contrast
                  </span>
                )}
                
                {scheme.accessibility.colorBlindSupport.protanopia && (
                  <span className="accessibility-badge" aria-label="Color blind friendly">
                    👁️ Color Blind Friendly
                  </span>
                )}
              </div>
              
              <div className="scheme-actions">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing(scheme);
                  }}
                  aria-label={`Edit ${scheme.name}`}
                >
                  Edit
                </button>
                
                {scheme.isUserCreated && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSchemeDelete(scheme.id);
                    }}
                    aria-label={`Delete ${scheme.name}`}
                    className="delete-button"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Color editor */}
      {editingScheme && (
        <div className="color-editor" role="region" aria-labelledby="color-editor-title">
          <div className="editor-header">
            <h3 id="color-editor-title">Editing: {editingScheme.name}</h3>
            
            <div className="editor-controls">
              <label className="preview-toggle">
                <input
                  type="checkbox"
                  checked={previewMode}
                  onChange={(e) => setPreviewMode(e.target.checked)}
                />
                Live Preview
              </label>
              
              <label className="colorblind-toggle">
                <input
                  type="checkbox"
                  checked={colorBlindPreview}
                  onChange={(e) => setColorBlindPreview(e.target.checked)}
                />
                Color Blind Preview
              </label>
              
              {colorBlindPreview && (
                <select
                  value={colorBlindnessType || 'protanopia'}
                  onChange={(e) => setColorBlindPreview(true)}
                  aria-label="Color blindness type"
                >
                  <option value="protanopia">Protanopia (Red-blind)</option>
                  <option value="deuteranopia">Deuteranopia (Green-blind)</option>
                  <option value="tritanopia">Tritanopia (Blue-blind)</option>
                  <option value="achromatopsia">Achromatopsia (Complete)</option>
                </select>
              )}
            </div>
          </div>

          {/* Category tabs */}
          <div className="category-tabs" role="tablist">
            {(Object.keys(editingScheme.colors) as Array<keyof ColorPalette>).map(category => (
              <button
                key={category}
                role="tab"
                aria-selected={selectedCategory === category}
                aria-controls={`panel-${category}`}
                onClick={() => setSelectedCategory(category)}
                className={selectedCategory === category ? 'active' : ''}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>

          {/* Category panels */}
          <div 
            id={`panel-${selectedCategory}`}
            role="tabpanel"
            aria-labelledby={`tab-${selectedCategory}`}
            className="category-panel"
          >
            {renderCategoryEditor(selectedCategory)}
          </div>

          {/* Contrast analysis */}
          {contrastAnalysis && (
            <div className="contrast-analysis" role="region" aria-labelledby="contrast-title">
              <h4 id="contrast-title">Accessibility Analysis</h4>
              
              <div className="contrast-results">
                <div className="contrast-item">
                  <span>Text on Background:</span>
                  <span className={contrastAnalysis.textOnBackground >= 4.5 ? 'pass' : 'fail'}>
                    {contrastAnalysis.textOnBackground.toFixed(2)}:1
                  </span>
                </div>
                
                <div className="wcag-compliance">
                  <span>WCAG AA: {contrastAnalysis.wcagAA ? '✅ Pass' : '❌ Fail'}</span>
                  <span>WCAG AAA: {contrastAnalysis.wcagAAA ? '✅ Pass' : '❌ Fail'}</span>
                </div>
                
                {contrastAnalysis.issues.length > 0 && (
                  <div className="contrast-issues" role="alert">
                    <h5>Issues:</h5>
                    <ul>
                      {contrastAnalysis.issues.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Editor actions */}
          <div className="editor-actions">
            <button
              onClick={handleCreateScheme}
              className="save-button"
              disabled={!editingScheme}
            >
              Save Scheme
            </button>
            
            <button
              onClick={() => setEditingScheme(null)}
              className="cancel-button"
            >
              Cancel
            </button>
            
            <button
              onClick={() => {
                const accessible = generateAccessiblePalette(editingScheme.colors.brand.primary);
                setEditingScheme({
                  ...editingScheme,
                  colors: { ...editingScheme.colors, ...accessible }
                });
              }}
              className="generate-button"
            >
              Generate Accessible Palette
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper interfaces
interface ContrastAnalysis {
  textOnBackground: number;
  textOnSecondary: number;
  linkOnBackground: number;
  buttonContrast: number;
  focusContrast: number;
  wcagAA: boolean;
  wcagAAA: boolean;
  issues: string[];
}

// Helper functions
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  h /= 360;
  s /= 100;
  l /= 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}