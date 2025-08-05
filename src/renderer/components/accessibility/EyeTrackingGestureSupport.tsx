import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AccessibilityManager } from '../../../main/accessibility/AccessibilityManager';

export interface EyeTrackingConfig {
  enabled: boolean;
  calibrated: boolean;
  sensitivity: number; // 0.1 to 2.0
  dwellTime: number; // milliseconds
  smoothing: number; // 0.1 to 1.0
  gazeRadius: number; // pixels
  blinkDetection: boolean;
  fixationThreshold: number; // milliseconds
  saccadeThreshold: number; // pixels
}

export interface GestureConfig {
  enabled: boolean;
  handTracking: boolean;
  headTracking: boolean;
  faceTracking: boolean;
  gestureSet: 'basic' | 'advanced' | 'custom';
  sensitivity: number;
  confirmationRequired: boolean;
  gestureTimeout: number; // milliseconds
}

export interface EyeTrackingData {
  x: number;
  y: number;
  confidence: number;
  timestamp: number;
  leftEye: EyeData;
  rightEye: EyeData;
  fixation: FixationData | null;
  saccade: SaccadeData | null;
  blink: BlinkData | null;
}

export interface EyeData {
  x: number;
  y: number;
  pupilDiameter: number;
  isOpen: boolean;
  confidence: number;
}

export interface FixationData {
  x: number;
  y: number;
  duration: number;
  startTime: number;
  stability: number;
}

export interface SaccadeData {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  velocity: number;
  amplitude: number;
  duration: number;
}

export interface BlinkData {
  duration: number;
  timestamp: number;
  isVoluntary: boolean;
}

export interface GestureData {
  type: GestureType;
  confidence: number;
  timestamp: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  landmarks?: GestureLandmark[];
}

export interface GestureLandmark {
  id: string;
  x: number;
  y: number;
  z?: number;
  confidence: number;
}

export type GestureType = 
  | 'point' | 'click' | 'drag' | 'scroll' | 'zoom' | 'swipe'
  | 'thumbs_up' | 'thumbs_down' | 'peace' | 'ok' | 'fist'
  | 'head_nod' | 'head_shake' | 'head_tilt'
  | 'smile' | 'frown' | 'blink' | 'wink' | 'eyebrow_raise';

export interface AccessibilityAction {
  id: string;
  name: string;
  description: string;
  trigger: AccessibilityTrigger;
  action: () => void;
  feedback: AccessibilityFeedback;
  isEnabled: boolean;
}

export interface AccessibilityTrigger {
  type: 'eye_gaze' | 'gesture' | 'dwell' | 'blink' | 'fixation';
  parameters: Record<string, any>;
  confirmation?: 'none' | 'dwell' | 'gesture' | 'voice';
}

export interface AccessibilityFeedback {
  visual: boolean;
  audio: boolean;
  haptic: boolean;
  message: string;
}

export interface EyeTrackingGestureSupportProps {
  eyeTrackingConfig: EyeTrackingConfig;
  gestureConfig: GestureConfig;
  onEyeTrackingData: (data: EyeTrackingData) => void;
  onGestureDetected: (gesture: GestureData) => void;
  onConfigChange: (eyeConfig: EyeTrackingConfig, gestureConfig: GestureConfig) => void;
  accessibilityActions: AccessibilityAction[];
  isCalibrating: boolean;
  onCalibrationStart: () => void;
  onCalibrationComplete: (success: boolean) => void;
}

export const EyeTrackingGestureSupport: React.FC<EyeTrackingGestureSupportProps> = ({
  eyeTrackingConfig,
  gestureConfig,
  onEyeTrackingData,
  onGestureDetected,
  onConfigChange,
  accessibilityActions,
  isCalibrating,
  onCalibrationStart,
  onCalibrationComplete
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentGaze, setCurrentGaze] = useState<{ x: number; y: number } | null>(null);
  const [dwellTarget, setDwellTarget] = useState<{ x: number; y: number; startTime: number } | null>(null);
  const [detectedGestures, setDetectedGestures] = useState<GestureData[]>([]);
  const [calibrationPoints, setCalibrationPoints] = useState<{ x: number; y: number }[]>([]);
  const [currentCalibrationPoint, setCurrentCalibrationPoint] = useState(0);
  const [systemStatus, setSystemStatus] = useState<'initializing' | 'ready' | 'error' | 'calibrating'>('initializing');
  const [announcements, setAnnouncements] = useState<string[]>([]);

  // Refs for tracking
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gazeOverlayRef = useRef<HTMLDivElement>(null);
  const dwellTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gestureHistoryRef = useRef<GestureData[]>([]);
  const eyeTrackingWorkerRef = useRef<Worker | null>(null);

  // Initialize eye tracking and gesture recognition
  useEffect(() => {
    initializeTracking();
    return () => {
      cleanup();
    };
  }, []);

  const initializeTracking = async () => {
    try {
      setSystemStatus('initializing');
      
      // Request camera permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Initialize eye tracking worker
      if (eyeTrackingConfig.enabled) {
        await initializeEyeTracking();
      }

      // Initialize gesture recognition
      if (gestureConfig.enabled) {
        await initializeGestureRecognition();
      }

      setIsInitialized(true);
      setSystemStatus('ready');
      announceToScreenReader('Eye tracking and gesture recognition initialized');

    } catch (error) {
      console.error('Failed to initialize tracking:', error);
      setSystemStatus('error');
      announceToScreenReader('Failed to initialize tracking systems');
    }
  };

  const initializeEyeTracking = async () => {
    // Initialize WebGL-based eye tracking
    if (typeof Worker !== 'undefined') {
      eyeTrackingWorkerRef.current = new Worker('/workers/eyeTracking.js');
      
      eyeTrackingWorkerRef.current.onmessage = (event) => {
        const { type, data } = event.data;
        
        switch (type) {
          case 'eyeTrackingData':
            handleEyeTrackingData(data);
            break;
          case 'calibrationUpdate':
            handleCalibrationUpdate(data);
            break;
          case 'error':
            console.error('Eye tracking error:', data);
            break;
        }
      };

      // Send configuration to worker
      eyeTrackingWorkerRef.current.postMessage({
        type: 'configure',
        config: eyeTrackingConfig
      });
    }
  };

  const initializeGestureRecognition = async () => {
    // Initialize MediaPipe or similar gesture recognition
    // This would typically use a library like @mediapipe/hands
    
    const processFrame = () => {
      if (videoRef.current && canvasRef.current && gestureConfig.enabled) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          
          // Process frame for gestures (simplified)
          detectGestures(canvas);
        }
      }
      
      if (gestureConfig.enabled) {
        requestAnimationFrame(processFrame);
      }
    };
    
    processFrame();
  };

  const handleEyeTrackingData = (data: EyeTrackingData) => {
    setCurrentGaze({ x: data.x, y: data.y });
    onEyeTrackingData(data);
    
    // Update gaze overlay
    if (gazeOverlayRef.current) {
      gazeOverlayRef.current.style.left = `${data.x - eyeTrackingConfig.gazeRadius}px`;
      gazeOverlayRef.current.style.top = `${data.y - eyeTrackingConfig.gazeRadius}px`;
    }
    
    // Handle dwell detection
    if (data.fixation && data.fixation.duration > eyeTrackingConfig.dwellTime) {
      handleDwellAction(data.fixation.x, data.fixation.y);
    }
    
    // Handle blink actions
    if (data.blink && eyeTrackingConfig.blinkDetection) {
      handleBlinkAction(data.blink);
    }
  };

  const handleDwellAction = (x: number, y: number) => {
    // Find element at gaze position
    const element = document.elementFromPoint(x, y);
    
    if (element) {
      // Check if element has accessibility actions
      const action = accessibilityActions.find(a => 
        a.trigger.type === 'dwell' && 
        element.matches(a.trigger.parameters.selector)
      );
      
      if (action && action.isEnabled) {
        executeAccessibilityAction(action);
      } else {
        // Default dwell action (click)
        simulateClick(x, y);
      }
    }
  };

  const handleBlinkAction = (blink: BlinkData) => {
    if (blink.isVoluntary && blink.duration > 200 && blink.duration < 1000) {
      // Find blink-triggered actions
      const blinkActions = accessibilityActions.filter(a => 
        a.trigger.type === 'blink' && a.isEnabled
      );
      
      if (blinkActions.length > 0) {
        executeAccessibilityAction(blinkActions[0]);
      }
    }
  };

  const detectGestures = (canvas: HTMLCanvasElement) => {
    // Simplified gesture detection
    // In a real implementation, this would use MediaPipe or similar
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Mock gesture detection for demonstration
    const mockGesture: GestureData = {
      type: 'point',
      confidence: 0.8,
      timestamp: Date.now(),
      position: { x: 100, y: 100 },
      velocity: { x: 0, y: 0 }
    };
    
    // Add to gesture history
    gestureHistoryRef.current.push(mockGesture);
    if (gestureHistoryRef.current.length > 10) {
      gestureHistoryRef.current.shift();
    }
    
    // Process gesture
    processGesture(mockGesture);
  };

  const processGesture = (gesture: GestureData) => {
    setDetectedGestures(prev => [...prev.slice(-4), gesture]);
    onGestureDetected(gesture);
    
    // Find matching accessibility actions
    const matchingActions = accessibilityActions.filter(action => 
      action.trigger.type === 'gesture' && 
      action.trigger.parameters.gestureType === gesture.type &&
      action.isEnabled
    );
    
    if (matchingActions.length > 0) {
      const action = matchingActions[0];
      
      if (gestureConfig.confirmationRequired) {
        // Show confirmation UI
        showGestureConfirmation(action, gesture);
      } else {
        executeAccessibilityAction(action);
      }
    }
  };

  const executeAccessibilityAction = (action: AccessibilityAction) => {
    try {
      action.action();
      
      // Provide feedback
      if (action.feedback.visual) {
        showVisualFeedback(action.feedback.message);
      }
      
      if (action.feedback.audio) {
        announceToScreenReader(action.feedback.message);
      }
      
      if (action.feedback.haptic && 'vibrate' in navigator) {
        navigator.vibrate(100);
      }
      
    } catch (error) {
      console.error('Failed to execute accessibility action:', error);
      announceToScreenReader('Action failed');
    }
  };

  const simulateClick = (x: number, y: number) => {
    const element = document.elementFromPoint(x, y);
    if (element) {
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y
      });
      element.dispatchEvent(clickEvent);
      
      showVisualFeedback('Clicked', x, y);
      announceToScreenReader('Element clicked');
    }
  };

  const showVisualFeedback = (message: string, x?: number, y?: number) => {
    const feedback = document.createElement('div');
    feedback.className = 'accessibility-feedback';
    feedback.textContent = message;
    feedback.style.position = 'fixed';
    feedback.style.left = `${x || currentGaze?.x || 0}px`;
    feedback.style.top = `${y || currentGaze?.y || 0}px`;
    feedback.style.zIndex = '10000';
    feedback.style.background = 'rgba(0, 0, 0, 0.8)';
    feedback.style.color = 'white';
    feedback.style.padding = '4px 8px';
    feedback.style.borderRadius = '4px';
    feedback.style.fontSize = '12px';
    feedback.style.pointerEvents = 'none';
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
      document.body.removeChild(feedback);
    }, 1000);
  };

  const showGestureConfirmation = (action: AccessibilityAction, gesture: GestureData) => {
    // Implementation for gesture confirmation UI
    announceToScreenReader(`Gesture detected: ${gesture.type}. Confirm to execute ${action.name}`);
  };

  const startCalibration = () => {
    if (!eyeTrackingConfig.enabled) return;
    
    setSystemStatus('calibrating');
    onCalibrationStart();
    
    // Generate calibration points (9-point calibration)
    const points = [
      { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.9, y: 0.1 },
      { x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 },
      { x: 0.1, y: 0.9 }, { x: 0.5, y: 0.9 }, { x: 0.9, y: 0.9 }
    ].map(point => ({
      x: point.x * window.innerWidth,
      y: point.y * window.innerHeight
    }));
    
    setCalibrationPoints(points);
    setCurrentCalibrationPoint(0);
    
    announceToScreenReader('Calibration started. Look at the red dot and press space when ready.');
  };

  const handleCalibrationUpdate = (data: any) => {
    if (currentCalibrationPoint < calibrationPoints.length - 1) {
      setCurrentCalibrationPoint(prev => prev + 1);
      announceToScreenReader(`Calibration point ${currentCalibrationPoint + 2} of ${calibrationPoints.length}`);
    } else {
      // Calibration complete
      setSystemStatus('ready');
      setCalibrationPoints([]);
      setCurrentCalibrationPoint(0);
      onCalibrationComplete(true);
      announceToScreenReader('Calibration completed successfully');
    }
  };

  const handleCalibrationKeyPress = (e: KeyboardEvent) => {
    if (isCalibrating && e.code === 'Space') {
      e.preventDefault();
      
      if (eyeTrackingWorkerRef.current) {
        const point = calibrationPoints[currentCalibrationPoint];
        eyeTrackingWorkerRef.current.postMessage({
          type: 'calibrate',
          point: point
        });
      }
    }
  };

  useEffect(() => {
    if (isCalibrating) {
      document.addEventListener('keydown', handleCalibrationKeyPress);
      return () => document.removeEventListener('keydown', handleCalibrationKeyPress);
    }
  }, [isCalibrating, currentCalibrationPoint]);

  const announceToScreenReader = (message: string) => {
    setAnnouncements(prev => [...prev, message]);
    setTimeout(() => {
      setAnnouncements(prev => prev.slice(1));
    }, 1000);
  };

  const cleanup = () => {
    if (eyeTrackingWorkerRef.current) {
      eyeTrackingWorkerRef.current.terminate();
    }
    
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current);
    }
    
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const renderCalibrationOverlay = () => {
    if (!isCalibrating || calibrationPoints.length === 0) return null;
    
    const currentPoint = calibrationPoints[currentCalibrationPoint];
    
    return (
      <div className="calibration-overlay">
        <div className="calibration-instructions">
          <h3>Eye Tracking Calibration</h3>
          <p>Look at the red dot and press SPACE when ready</p>
          <p>Point {currentCalibrationPoint + 1} of {calibrationPoints.length}</p>
        </div>
        
        <div
          className="calibration-point"
          style={{
            position: 'fixed',
            left: `${currentPoint.x - 10}px`,
            top: `${currentPoint.y - 10}px`,
            width: '20px',
            height: '20px',
            backgroundColor: 'red',
            borderRadius: '50%',
            zIndex: 10000
          }}
        />
      </div>
    );
  };

  const renderGazeOverlay = () => {
    if (!eyeTrackingConfig.enabled || !currentGaze) return null;
    
    return (
      <div
        ref={gazeOverlayRef}
        className="gaze-overlay"
        style={{
          position: 'fixed',
          width: `${eyeTrackingConfig.gazeRadius * 2}px`,
          height: `${eyeTrackingConfig.gazeRadius * 2}px`,
          borderRadius: '50%',
          border: '2px solid rgba(0, 255, 0, 0.5)',
          pointerEvents: 'none',
          zIndex: 9999,
          transition: 'all 0.1s ease'
        }}
      />
    );
  };

  const renderGestureIndicators = () => {
    if (!gestureConfig.enabled) return null;
    
    return (
      <div className="gesture-indicators">
        {detectedGestures.slice(-3).map((gesture, index) => (
          <div
            key={`${gesture.timestamp}-${index}`}
            className="gesture-indicator"
            style={{
              position: 'fixed',
              left: `${gesture.position.x}px`,
              top: `${gesture.position.y}px`,
              zIndex: 9998,
              background: 'rgba(0, 0, 255, 0.7)',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '12px',
              pointerEvents: 'none',
              animation: 'fadeOut 2s ease-out forwards'
            }}
          >
            {gesture.type}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="eye-tracking-gesture-support">
      {/* Screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcements.map((announcement, index) => (
          <div key={index}>{announcement}</div>
        ))}
      </div>

      {/* Hidden video element for camera input */}
      <video
        ref={videoRef}
        style={{ display: 'none' }}
        autoPlay
        muted
        playsInline
      />

      {/* Hidden canvas for gesture processing */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
        width={640}
        height={480}
      />

      {/* System status */}
      <div className="system-status" role="status">
        <div className={`status-indicator ${systemStatus}`}>
          {systemStatus === 'ready' && '🟢'}
          {systemStatus === 'initializing' && '🟡'}
          {systemStatus === 'calibrating' && '🔵'}
          {systemStatus === 'error' && '🔴'}
        </div>
        <span>System Status: {systemStatus}</span>
      </div>

      {/* Controls */}
      <div className="tracking-controls">
        <button
          onClick={startCalibration}
          disabled={!eyeTrackingConfig.enabled || systemStatus !== 'ready'}
          className="calibrate-button"
        >
          Calibrate Eye Tracking
        </button>
        
        <button
          onClick={() => {
            const newEyeConfig = { ...eyeTrackingConfig, enabled: !eyeTrackingConfig.enabled };
            onConfigChange(newEyeConfig, gestureConfig);
          }}
          className="toggle-eye-tracking"
        >
          {eyeTrackingConfig.enabled ? 'Disable' : 'Enable'} Eye Tracking
        </button>
        
        <button
          onClick={() => {
            const newGestureConfig = { ...gestureConfig, enabled: !gestureConfig.enabled };
            onConfigChange(eyeTrackingConfig, newGestureConfig);
          }}
          className="toggle-gestures"
        >
          {gestureConfig.enabled ? 'Disable' : 'Enable'} Gestures
        </button>
      </div>

      {/* Configuration panel */}
      <div className="config-panel">
        <h3>Eye Tracking Settings</h3>
        <div className="config-group">
          <label>
            Sensitivity:
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.1"
              value={eyeTrackingConfig.sensitivity}
              onChange={(e) => {
                const newConfig = { ...eyeTrackingConfig, sensitivity: parseFloat(e.target.value) };
                onConfigChange(newConfig, gestureConfig);
              }}
            />
            <span>{eyeTrackingConfig.sensitivity}</span>
          </label>
        </div>
        
        <div className="config-group">
          <label>
            Dwell Time (ms):
            <input
              type="range"
              min="500"
              max="3000"
              step="100"
              value={eyeTrackingConfig.dwellTime}
              onChange={(e) => {
                const newConfig = { ...eyeTrackingConfig, dwellTime: parseInt(e.target.value) };
                onConfigChange(newConfig, gestureConfig);
              }}
            />
            <span>{eyeTrackingConfig.dwellTime}ms</span>
          </label>
        </div>

        <h3>Gesture Settings</h3>
        <div className="config-group">
          <label>
            <input
              type="checkbox"
              checked={gestureConfig.confirmationRequired}
              onChange={(e) => {
                const newConfig = { ...gestureConfig, confirmationRequired: e.target.checked };
                onConfigChange(eyeTrackingConfig, newConfig);
              }}
            />
            Require confirmation for gestures
          </label>
        </div>
      </div>

      {/* Overlays */}
      {renderGazeOverlay()}
      {renderGestureIndicators()}
      {renderCalibrationOverlay()}

      <style jsx>{`
        .accessibility-feedback {
          animation: fadeOut 1s ease-out forwards;
        }
        
        @keyframes fadeOut {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.8); }
        }
        
        .calibration-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10001;
        }
        
        .calibration-instructions {
          background: white;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
          position: absolute;
          top: 50px;
          left: 50%;
          transform: translateX(-50%);
        }
        
        .system-status {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }
        
        .tracking-controls {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }
        
        .config-panel {
          background: #f5f5f5;
          padding: 16px;
          border-radius: 8px;
        }
        
        .config-group {
          margin-bottom: 12px;
        }
        
        .config-group label {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      `}</style>
    </div>
  );
};