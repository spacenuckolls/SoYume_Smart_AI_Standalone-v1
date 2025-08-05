import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DndProvider, useDrag, useDrop, DropTargetMonitor } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { AccessibilityManager } from '../../../main/accessibility/AccessibilityManager';

export interface LayoutComponent {
  id: string;
  type: 'toolbar' | 'sidebar' | 'panel' | 'editor' | 'statusbar' | 'menu';
  title: string;
  content: React.ComponentType<any>;
  defaultPosition: LayoutPosition;
  currentPosition: LayoutPosition;
  size: LayoutSize;
  isVisible: boolean;
  isResizable: boolean;
  isDraggable: boolean;
  minSize?: LayoutSize;
  maxSize?: LayoutSize;
  accessibilityProps?: AccessibilityProps;
}

export interface LayoutPosition {
  zone: 'top' | 'left' | 'center' | 'right' | 'bottom' | 'floating';
  order: number;
  x?: number;
  y?: number;
}

export interface LayoutSize {
  width: number | 'auto' | 'fill';
  height: number | 'auto' | 'fill';
}

export interface AccessibilityProps {
  role?: string;
  ariaLabel?: string;
  ariaDescription?: string;
  tabIndex?: number;
  focusable?: boolean;
  landmark?: boolean;
  skipLink?: boolean;
}

export interface LayoutZone {
  id: string;
  type: 'horizontal' | 'vertical' | 'grid' | 'floating';
  components: string[];
  constraints?: LayoutConstraints;
  accessibilityProps?: AccessibilityProps;
}

export interface LayoutConstraints {
  minComponents?: number;
  maxComponents?: number;
  allowedTypes?: string[];
  requiredTypes?: string[];
}

export interface CustomizableLayoutProps {
  components: LayoutComponent[];
  zones: LayoutZone[];
  onLayoutChange: (components: LayoutComponent[], zones: LayoutZone[]) => void;
  accessibilityMode: 'standard' | 'enhanced' | 'high-contrast' | 'screen-reader';
  enableDragDrop: boolean;
  enableResize: boolean;
  showLayoutGuides: boolean;
  snapToGrid: boolean;
  gridSize: number;
}

const ITEM_TYPE = 'layout-component';

export const CustomizableLayout: React.FC<CustomizableLayoutProps> = ({
  components,
  zones,
  onLayoutChange,
  accessibilityMode,
  enableDragDrop,
  enableResize,
  showLayoutGuides,
  snapToGrid,
  gridSize
}) => {
  const [draggedComponent, setDraggedComponent] = useState<string | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [isLayoutMode, setIsLayoutMode] = useState(false);
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const layoutRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation state
  const [focusedComponent, setFocusedComponent] = useState<string | null>(null);
  const [keyboardMode, setKeyboardMode] = useState(false);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLayoutMode) return;

      switch (e.key) {
        case 'Tab':
          e.preventDefault();
          navigateComponents(e.shiftKey ? 'previous' : 'next');
          break;
        case 'Enter':
        case ' ':
          if (focusedComponent) {
            e.preventDefault();
            setSelectedComponent(focusedComponent);
            announceToScreenReader(`Selected ${getComponentTitle(focusedComponent)}`);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setSelectedComponent(null);
          setIsLayoutMode(false);
          announceToScreenReader('Exited layout customization mode');
          break;
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
          if (selectedComponent) {
            e.preventDefault();
            moveComponent(selectedComponent, e.key);
          }
          break;
        case 'F2':
          e.preventDefault();
          setIsLayoutMode(!isLayoutMode);
          setKeyboardMode(true);
          announceToScreenReader(
            isLayoutMode 
              ? 'Exited layout customization mode' 
              : 'Entered layout customization mode. Use Tab to navigate, Enter to select, arrow keys to move.'
          );
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLayoutMode, focusedComponent, selectedComponent]);

  const navigateComponents = (direction: 'next' | 'previous') => {
    const visibleComponents = components.filter(c => c.isVisible);
    const currentIndex = focusedComponent 
      ? visibleComponents.findIndex(c => c.id === focusedComponent)
      : -1;
    
    let nextIndex;
    if (direction === 'next') {
      nextIndex = currentIndex < visibleComponents.length - 1 ? currentIndex + 1 : 0;
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : visibleComponents.length - 1;
    }
    
    const nextComponent = visibleComponents[nextIndex];
    if (nextComponent) {
      setFocusedComponent(nextComponent.id);
      announceToScreenReader(`Focused on ${nextComponent.title}`);
    }
  };

  const moveComponent = (componentId: string, direction: string) => {
    const component = components.find(c => c.id === componentId);
    if (!component) return;

    const newComponents = [...components];
    const componentIndex = newComponents.findIndex(c => c.id === componentId);
    
    let newPosition = { ...component.currentPosition };
    const moveDistance = snapToGrid ? gridSize : 10;

    switch (direction) {
      case 'ArrowUp':
        if (component.currentPosition.zone === 'floating' && component.currentPosition.y) {
          newPosition.y = Math.max(0, component.currentPosition.y - moveDistance);
        } else {
          newPosition.order = Math.max(0, newPosition.order - 1);
        }
        break;
      case 'ArrowDown':
        if (component.currentPosition.zone === 'floating' && component.currentPosition.y !== undefined) {
          newPosition.y = component.currentPosition.y + moveDistance;
        } else {
          newPosition.order = newPosition.order + 1;
        }
        break;
      case 'ArrowLeft':
        if (component.currentPosition.zone === 'floating' && component.currentPosition.x) {
          newPosition.x = Math.max(0, component.currentPosition.x - moveDistance);
        } else {
          // Move to left zone
          newPosition.zone = 'left';
          newPosition.order = 0;
        }
        break;
      case 'ArrowRight':
        if (component.currentPosition.zone === 'floating' && component.currentPosition.x !== undefined) {
          newPosition.x = component.currentPosition.x + moveDistance;
        } else {
          // Move to right zone
          newPosition.zone = 'right';
          newPosition.order = 0;
        }
        break;
    }

    newComponents[componentIndex] = {
      ...component,
      currentPosition: newPosition
    };

    onLayoutChange(newComponents, zones);
    announceToScreenReader(`Moved ${component.title} ${direction.replace('Arrow', '').toLowerCase()}`);
  };

  const getComponentTitle = (componentId: string): string => {
    const component = components.find(c => c.id === componentId);
    return component?.title || 'Unknown component';
  };

  const announceToScreenReader = (message: string) => {
    setAnnouncements(prev => [...prev, message]);
    // Clear announcement after a delay
    setTimeout(() => {
      setAnnouncements(prev => prev.slice(1));
    }, 1000);
  };

  const handleComponentDrop = useCallback((componentId: string, targetZone: string, targetIndex: number) => {
    const newComponents = components.map(component => {
      if (component.id === componentId) {
        return {
          ...component,
          currentPosition: {
            ...component.currentPosition,
            zone: targetZone as any,
            order: targetIndex
          }
        };
      }
      return component;
    });

    const newZones = zones.map(zone => {
      if (zone.id === targetZone) {
        const updatedComponents = [...zone.components];
        const existingIndex = updatedComponents.indexOf(componentId);
        
        if (existingIndex !== -1) {
          updatedComponents.splice(existingIndex, 1);
        }
        
        updatedComponents.splice(targetIndex, 0, componentId);
        
        return {
          ...zone,
          components: updatedComponents
        };
      } else {
        return {
          ...zone,
          components: zone.components.filter(id => id !== componentId)
        };
      }
    });

    onLayoutChange(newComponents, newZones);
    announceToScreenReader(`Moved ${getComponentTitle(componentId)} to ${targetZone}`);
  }, [components, zones, onLayoutChange]);

  const renderComponent = (component: LayoutComponent) => {
    const ComponentContent = component.content;
    
    return (
      <DraggableComponent
        key={component.id}
        component={component}
        isSelected={selectedComponent === component.id}
        isFocused={focusedComponent === component.id}
        isDragEnabled={enableDragDrop && isLayoutMode}
        isResizeEnabled={enableResize && isLayoutMode}
        accessibilityMode={accessibilityMode}
        onSelect={() => setSelectedComponent(component.id)}
        onFocus={() => setFocusedComponent(component.id)}
        onResize={(newSize) => handleComponentResize(component.id, newSize)}
      >
        <ComponentContent />
      </DraggableComponent>
    );
  };

  const handleComponentResize = (componentId: string, newSize: LayoutSize) => {
    const newComponents = components.map(component => {
      if (component.id === componentId) {
        return {
          ...component,
          size: newSize
        };
      }
      return component;
    });

    onLayoutChange(newComponents, zones);
    announceToScreenReader(`Resized ${getComponentTitle(componentId)}`);
  };

  const renderZone = (zone: LayoutZone) => {
    const zoneComponents = zone.components
      .map(id => components.find(c => c.id === id))
      .filter(Boolean) as LayoutComponent[];

    return (
      <DropZone
        key={zone.id}
        zone={zone}
        components={zoneComponents}
        isHovered={hoveredZone === zone.id}
        showGuides={showLayoutGuides && isLayoutMode}
        accessibilityMode={accessibilityMode}
        onDrop={handleComponentDrop}
        onHover={(isHovering) => setHoveredZone(isHovering ? zone.id : null)}
      >
        {zoneComponents.map(component => renderComponent(component))}
      </DropZone>
    );
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div 
        ref={layoutRef}
        className={`customizable-layout ${accessibilityMode} ${isLayoutMode ? 'layout-mode' : ''}`}
        role="application"
        aria-label="Customizable application layout"
        aria-describedby="layout-instructions"
      >
        {/* Screen reader announcements */}
        <div 
          aria-live="polite" 
          aria-atomic="true" 
          className="sr-only"
        >
          {announcements.map((announcement, index) => (
            <div key={index}>{announcement}</div>
          ))}
        </div>

        {/* Layout instructions for screen readers */}
        <div id="layout-instructions" className="sr-only">
          Press F2 to enter layout customization mode. Use Tab to navigate components, 
          Enter to select, arrow keys to move selected components, and Escape to exit.
        </div>

        {/* Layout controls */}
        {isLayoutMode && (
          <div className="layout-controls" role="toolbar" aria-label="Layout controls">
            <button
              onClick={() => setIsLayoutMode(false)}
              aria-label="Exit layout mode"
            >
              Exit Layout Mode
            </button>
            
            <button
              onClick={() => resetLayout()}
              aria-label="Reset to default layout"
            >
              Reset Layout
            </button>
            
            <button
              onClick={() => saveLayoutPreset()}
              aria-label="Save current layout as preset"
            >
              Save Preset
            </button>
          </div>
        )}

        {/* Main layout zones */}
        <div className="layout-container">
          {zones.map(zone => renderZone(zone))}
        </div>

        {/* Layout guides */}
        {showLayoutGuides && isLayoutMode && (
          <LayoutGuides 
            gridSize={gridSize}
            snapToGrid={snapToGrid}
          />
        )}

        {/* Floating components */}
        <div className="floating-components">
          {components
            .filter(c => c.currentPosition.zone === 'floating' && c.isVisible)
            .map(component => renderComponent(component))
          }
        </div>
      </div>
    </DndProvider>
  );

  function resetLayout() {
    const resetComponents = components.map(component => ({
      ...component,
      currentPosition: { ...component.defaultPosition }
    }));
    onLayoutChange(resetComponents, zones);
    announceToScreenReader('Layout reset to default');
  }

  function saveLayoutPreset() {
    // Implementation for saving layout presets
    announceToScreenReader('Layout preset saved');
  }
};

// Draggable component wrapper
interface DraggableComponentProps {
  component: LayoutComponent;
  isSelected: boolean;
  isFocused: boolean;
  isDragEnabled: boolean;
  isResizeEnabled: boolean;
  accessibilityMode: string;
  onSelect: () => void;
  onFocus: () => void;
  onResize: (size: LayoutSize) => void;
  children: React.ReactNode;
}

const DraggableComponent: React.FC<DraggableComponentProps> = ({
  component,
  isSelected,
  isFocused,
  isDragEnabled,
  isResizeEnabled,
  accessibilityMode,
  onSelect,
  onFocus,
  onResize,
  children
}) => {
  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPE,
    item: { id: component.id, type: component.type },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    }),
    canDrag: isDragEnabled && component.isDraggable
  });

  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === resizeRef.current) {
      setIsResizing(true);
      e.preventDefault();
    }
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (resizeRef.current) {
        const rect = resizeRef.current.getBoundingClientRect();
        const newWidth = e.clientX - rect.left;
        const newHeight = e.clientY - rect.top;
        
        onResize({
          width: Math.max(100, newWidth),
          height: Math.max(50, newHeight)
        });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onResize]);

  return (
    <div
      ref={drag}
      className={`
        draggable-component 
        ${isDragging ? 'dragging' : ''} 
        ${isSelected ? 'selected' : ''} 
        ${isFocused ? 'focused' : ''}
        ${accessibilityMode}
      `}
      style={{
        width: component.size.width,
        height: component.size.height,
        opacity: isDragging ? 0.5 : 1
      }}
      onClick={onSelect}
      onFocus={onFocus}
      tabIndex={isFocused ? 0 : -1}
      role={component.accessibilityProps?.role || 'region'}
      aria-label={component.accessibilityProps?.ariaLabel || component.title}
      aria-describedby={component.accessibilityProps?.ariaDescription}
    >
      <div className="component-header">
        <span className="component-title">{component.title}</span>
        {isSelected && (
          <div className="component-controls">
            <button
              aria-label={`Hide ${component.title}`}
              onClick={(e) => {
                e.stopPropagation();
                // Handle hide component
              }}
            >
              ×
            </button>
          </div>
        )}
      </div>
      
      <div className="component-content">
        {children}
      </div>

      {isResizeEnabled && component.isResizable && (
        <div
          ref={resizeRef}
          className="resize-handle"
          onMouseDown={handleMouseDown}
          role="button"
          aria-label={`Resize ${component.title}`}
          tabIndex={0}
        />
      )}
    </div>
  );
};

// Drop zone component
interface DropZoneProps {
  zone: LayoutZone;
  components: LayoutComponent[];
  isHovered: boolean;
  showGuides: boolean;
  accessibilityMode: string;
  onDrop: (componentId: string, zoneId: string, index: number) => void;
  onHover: (isHovering: boolean) => void;
  children: React.ReactNode;
}

const DropZone: React.FC<DropZoneProps> = ({
  zone,
  components,
  isHovered,
  showGuides,
  accessibilityMode,
  onDrop,
  onHover,
  children
}) => {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ITEM_TYPE,
    drop: (item: { id: string; type: string }, monitor) => {
      if (!monitor.didDrop()) {
        onDrop(item.id, zone.id, components.length);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop()
    }),
    hover: (item, monitor) => {
      onHover(monitor.isOver({ shallow: true }));
    }
  });

  return (
    <div
      ref={drop}
      className={`
        drop-zone 
        zone-${zone.type} 
        ${isOver && canDrop ? 'drop-target' : ''} 
        ${isHovered ? 'hovered' : ''}
        ${showGuides ? 'show-guides' : ''}
        ${accessibilityMode}
      `}
      data-zone-id={zone.id}
      role={zone.accessibilityProps?.role || 'region'}
      aria-label={zone.accessibilityProps?.ariaLabel || `${zone.id} zone`}
      aria-dropeffect={canDrop ? 'move' : 'none'}
    >
      {children}
      
      {isOver && canDrop && (
        <div className="drop-indicator" aria-hidden="true">
          Drop component here
        </div>
      )}
    </div>
  );
};

// Layout guides component
interface LayoutGuidesProps {
  gridSize: number;
  snapToGrid: boolean;
}

const LayoutGuides: React.FC<LayoutGuidesProps> = ({ gridSize, snapToGrid }) => {
  if (!snapToGrid) return null;

  return (
    <div className="layout-guides" aria-hidden="true">
      <svg className="grid-overlay">
        <defs>
          <pattern
            id="grid"
            width={gridSize}
            height={gridSize}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
              fill="none"
              stroke="rgba(0,0,0,0.1)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
};