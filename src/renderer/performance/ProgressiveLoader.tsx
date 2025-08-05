import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';

/**
 * Progressive loading system for UI components
 * Implements lazy loading, virtualization, and performance optimization
 */

// Main progressive loader component
export const ProgressiveLoader: React.FC<ProgressiveLoaderProps> = ({
  items,
  renderItem,
  itemHeight = 50,
  containerHeight = 400,
  overscan = 5,
  threshold = 0.1,
  loadingComponent: LoadingComponent = DefaultLoadingComponent,
  errorComponent: ErrorComponent = DefaultErrorComponent,
  emptyComponent: EmptyComponent = DefaultEmptyComponent,
  onLoadMore,
  hasMore = false,
  className = '',
  ...props
}) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  // Calculate visible items based on scroll position
  const calculateVisibleRange = useCallback(() => {
    if (!containerRef.current) return;

    const scrollTop = containerRef.current.scrollTop;
    const containerHeightValue = containerRef.current.clientHeight;
    
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeightValue / itemHeight);
    const end = Math.min(items.length, start + visibleCount + overscan * 2);

    setVisibleRange({ start, end });
  }, [items.length, itemHeight, overscan]);

  // Handle scroll events with throttling
  const handleScroll = useCallback(() => {
    calculateVisibleRange();
    
    // Check if we need to load more items
    if (hasMore && onLoadMore && !isLoading) {
      const container = containerRef.current;
      if (!container) return;

      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
      
      if (scrollPercentage > 1 - threshold) {
        setIsLoading(true);
        onLoadMore()
          .then(() => setIsLoading(false))
          .catch((err) => {
            setError(err);
            setIsLoading(false);
          });
      }
    }
  }, [calculateVisibleRange, hasMore, onLoadMore, isLoading, threshold]);

  // Throttled scroll handler
  const throttledScrollHandler = useThrottledCallback(handleScroll, 16); // ~60fps

  // Initialize visible range
  useEffect(() => {
    calculateVisibleRange();
  }, [calculateVisibleRange]);

  // Set up scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', throttledScrollHandler, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', throttledScrollHandler);
    };
  }, [throttledScrollHandler]);

  // Memoized visible items
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end);
  }, [items, visibleRange]);

  // Calculate total height and offset
  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.start * itemHeight;

  if (items.length === 0 && !isLoading) {
    return <EmptyComponent />;
  }

  if (error) {
    return <ErrorComponent error={error} onRetry={() => setError(null)} />;
  }

  return (
    <div
      ref={containerRef}
      className={`progressive-loader ${className}`}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative'
      }}
      {...props}
    >
      <div
        style={{
          height: totalHeight,
          position: 'relative'
        }}
      >
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={visibleRange.start + index}
              style={{ height: itemHeight }}
            >
              {renderItem(item, visibleRange.start + index)}
            </div>
          ))}
        </div>
      </div>
      
      {isLoading && (
        <div className="progressive-loader-loading">
          <LoadingComponent />
        </div>
      )}
    </div>
  );
};

// Lazy component loader
export const LazyComponent: React.FC<LazyComponentProps> = ({
  loader,
  fallback: Fallback = DefaultLoadingComponent,
  errorFallback: ErrorFallback = DefaultErrorComponent,
  delay = 200,
  timeout = 10000,
  retryCount = 3,
  onLoad,
  onError,
  ...props
}) => {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retries, setRetries] = useState(0);
  const mountedRef = useRef(true);

  const loadComponent = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Add minimum delay to prevent flashing
      const [componentModule] = await Promise.all([
        loader(),
        new Promise(resolve => setTimeout(resolve, delay))
      ]);

      if (!mountedRef.current) return;

      const LoadedComponent = componentModule.default || componentModule;
      setComponent(() => LoadedComponent);
      setIsLoading(false);
      
      if (onLoad) {
        onLoad(LoadedComponent);
      }
    } catch (err) {
      if (!mountedRef.current) return;

      const error = err as Error;
      
      if (retries < retryCount) {
        setRetries(prev => prev + 1);
        // Exponential backoff
        setTimeout(() => loadComponent(), Math.pow(2, retries) * 1000);
      } else {
        setError(error);
        setIsLoading(false);
        
        if (onError) {
          onError(error);
        }
      }
    }
  }, [loader, delay, retries, retryCount, onLoad, onError]);

  useEffect(() => {
    mountedRef.current = true;
    
    const timeoutId = setTimeout(() => {
      if (isLoading && mountedRef.current) {
        setError(new Error('Component loading timeout'));
        setIsLoading(false);
      }
    }, timeout);

    loadComponent();

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutId);
    };
  }, [loadComponent, timeout, isLoading]);

  if (error) {
    return <ErrorFallback error={error} onRetry={() => {
      setRetries(0);
      loadComponent();
    }} />;
  }

  if (isLoading || !Component) {
    return <Fallback />;
  }

  return <Component {...props} />;
};

// Image lazy loader with progressive enhancement
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  placeholder,
  className = '',
  onLoad,
  onError,
  threshold = 0.1,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(img);

    return () => observer.disconnect();
  }, [threshold]);

  // Load image when in view
  useEffect(() => {
    if (!isInView) return;

    const img = new Image();
    
    img.onload = () => {
      setIsLoaded(true);
      if (onLoad) onLoad();
    };
    
    img.onerror = () => {
      const error = new Error(`Failed to load image: ${src}`);
      setError(error);
      if (onError) onError(error);
    };
    
    img.src = src;
  }, [isInView, src, onLoad, onError]);

  return (
    <div className={`lazy-image ${className}`} {...props}>
      <img
        ref={imgRef}
        src={isLoaded ? src : placeholder}
        alt={alt}
        className={`lazy-image-img ${isLoaded ? 'loaded' : 'loading'}`}
        style={{
          opacity: isLoaded ? 1 : 0.5,
          transition: 'opacity 0.3s ease'
        }}
      />
      {error && (
        <div className="lazy-image-error">
          Failed to load image
        </div>
      )}
    </div>
  );
};

// Performance-optimized list component
export const VirtualizedList: React.FC<VirtualizedListProps> = ({
  items,
  renderItem,
  itemHeight,
  height,
  width = '100%',
  overscan = 5,
  className = '',
  onScroll,
  ...props
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    
    if (onScroll) {
      onScroll(e);
    }
  }, [onScroll]);

  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(height / itemHeight);
    const end = Math.min(items.length, start + visibleCount + overscan * 2);
    
    return { start, end };
  }, [scrollTop, itemHeight, height, overscan, items.length]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end);
  }, [items, visibleRange]);

  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.start * itemHeight;

  return (
    <div
      ref={containerRef}
      className={`virtualized-list ${className}`}
      style={{
        height,
        width,
        overflow: 'auto',
        position: 'relative'
      }}
      onScroll={handleScroll}
      {...props}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={visibleRange.start + index}
              style={{ height: itemHeight }}
            >
              {renderItem(item, visibleRange.start + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Code splitting utility
export const createLazyComponent = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyComponentOptions = {}
) => {
  return React.lazy(async () => {
    try {
      const module = await importFn();
      
      // Add artificial delay for testing
      if (options.delay && process.env.NODE_ENV === 'development') {
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }
      
      return module;
    } catch (error) {
      console.error('Failed to load component:', error);
      throw error;
    }
  });
};

// Performance monitoring hook
export const usePerformanceMonitor = (componentName: string) => {
  const renderStartTime = useRef<number>(Date.now());
  const renderCount = useRef<number>(0);

  useEffect(() => {
    renderCount.current++;
    const renderTime = Date.now() - renderStartTime.current;
    
    if (renderTime > 16) { // More than one frame at 60fps
      console.warn(`Slow render detected in ${componentName}: ${renderTime}ms`);
    }
    
    // Report to performance monitoring system
    if (window.performanceMonitor) {
      window.performanceMonitor.recordRender(componentName, renderTime, {
        renderCount: renderCount.current
      });
    }
  });

  useEffect(() => {
    renderStartTime.current = Date.now();
  });
};

// Throttled callback hook
export const useThrottledCallback = (callback: Function, delay: number) => {
  const lastCall = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback((...args: any[]) => {
    const now = Date.now();
    
    if (now - lastCall.current >= delay) {
      lastCall.current = now;
      callback(...args);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        lastCall.current = Date.now();
        callback(...args);
      }, delay - (now - lastCall.current));
    }
  }, [callback, delay]);
};

// Default components
const DefaultLoadingComponent: React.FC = () => (
  <div className="progressive-loader-default-loading">
    <div className="spinner" />
    <span>Loading...</span>
  </div>
);

const DefaultErrorComponent: React.FC<{ error: Error; onRetry?: () => void }> = ({ 
  error, 
  onRetry 
}) => (
  <div className="progressive-loader-default-error">
    <p>Error: {error.message}</p>
    {onRetry && (
      <button onClick={onRetry} className="retry-button">
        Retry
      </button>
    )}
  </div>
);

const DefaultEmptyComponent: React.FC = () => (
  <div className="progressive-loader-default-empty">
    <p>No items to display</p>
  </div>
);

// Types and interfaces
export interface ProgressiveLoaderProps {
  items: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
  itemHeight?: number;
  containerHeight?: number;
  overscan?: number;
  threshold?: number;
  loadingComponent?: React.ComponentType;
  errorComponent?: React.ComponentType<{ error: Error; onRetry?: () => void }>;
  emptyComponent?: React.ComponentType;
  onLoadMore?: () => Promise<void>;
  hasMore?: boolean;
  className?: string;
}

export interface LazyComponentProps {
  loader: () => Promise<any>;
  fallback?: React.ComponentType;
  errorFallback?: React.ComponentType<{ error: Error; onRetry?: () => void }>;
  delay?: number;
  timeout?: number;
  retryCount?: number;
  onLoad?: (component: React.ComponentType<any>) => void;
  onError?: (error: Error) => void;
}

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholder?: string;
  threshold?: number;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export interface VirtualizedListProps {
  items: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
  itemHeight: number;
  height: number;
  width?: string | number;
  overscan?: number;
  className?: string;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

export interface LazyComponentOptions {
  delay?: number;
}

// CSS styles (would typically be in a separate CSS file)
export const progressiveLoaderStyles = `
.progressive-loader {
  position: relative;
}

.progressive-loader-loading {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px;
  text-align: center;
  background: rgba(255, 255, 255, 0.9);
}

.progressive-loader-default-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  gap: 10px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.progressive-loader-default-error {
  padding: 20px;
  text-align: center;
  color: #e74c3c;
}

.retry-button {
  margin-top: 10px;
  padding: 8px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.retry-button:hover {
  background: #2980b9;
}

.progressive-loader-default-empty {
  padding: 40px;
  text-align: center;
  color: #7f8c8d;
}

.lazy-image {
  position: relative;
  overflow: hidden;
}

.lazy-image-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lazy-image-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #e74c3c;
  font-size: 14px;
}

.virtualized-list {
  scrollbar-width: thin;
  scrollbar-color: #bdc3c7 #ecf0f1;
}

.virtualized-list::-webkit-scrollbar {
  width: 8px;
}

.virtualized-list::-webkit-scrollbar-track {
  background: #ecf0f1;
}

.virtualized-list::-webkit-scrollbar-thumb {
  background: #bdc3c7;
  border-radius: 4px;
}

.virtualized-list::-webkit-scrollbar-thumb:hover {
  background: #95a5a6;
}
`;

// Global performance monitor interface
declare global {
  interface Window {
    performanceMonitor?: {
      recordRender: (component: string, duration: number, metadata?: any) => void;
    };
  }
}