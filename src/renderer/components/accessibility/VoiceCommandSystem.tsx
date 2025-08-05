import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AccessibilityManager } from '../../../main/accessibility/AccessibilityManager';

export interface VoiceCommand {
  id: string;
  name: string;
  description: string;
  patterns: string[];
  action: (parameters: VoiceParameters) => Promise<void>;
  category: 'navigation' | 'editing' | 'ai' | 'accessibility' | 'system';
  parameters?: VoiceParameter[];
  examples: string[];
  isEnabled: boolean;
  confidence: number;
  contextual: boolean;
  aliases: string[];
}

export interface VoiceParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'selection';
  required: boolean;
  description: string;
  options?: string[];
  validation?: (value: any) => boolean;
}

export interface VoiceParameters {
  [key: string]: any;
}

export interface VoiceRecognitionConfig {
  enabled: boolean;
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  confidenceThreshold: number;
  noiseReduction: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  wakeWord: string;
  wakeWordEnabled: boolean;
  commandTimeout: number;
  confirmationRequired: boolean;
}

export interface NLPConfig {
  enabled: boolean;
  provider: 'builtin' | 'openai' | 'anthropic';
  model: string;
  contextWindow: number;
  intentRecognition: boolean;
  entityExtraction: boolean;
  sentimentAnalysis: boolean;
  languageDetection: boolean;
}ex
port interface VoiceCommandSystemProps {
  voiceConfig: VoiceRecognitionConfig;
  nlpConfig: NLPConfig;
  availableCommands: VoiceCommand[];
  onCommandExecuted: (command: VoiceCommand, parameters: VoiceParameters) => void;
  onConfigChange: (voiceConfig: VoiceRecognitionConfig, nlpConfig: NLPConfig) => void;
  onTranscriptionUpdate: (text: string, isFinal: boolean) => void;
  isListening: boolean;
  onListeningChange: (listening: boolean) => void;
}

export const VoiceCommandSystem: React.FC<VoiceCommandSystemProps> = ({
  voiceConfig,
  nlpConfig,
  availableCommands,
  onCommandExecuted,
  onConfigChange,
  onTranscriptionUpdate,
  isListening,
  onListeningChange
}) => {
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [recognizedCommands, setRecognizedCommands] = useState<VoiceCommand[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [wakeWordDetected, setWakeWordDetected] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [announcements, setAnnouncements] = useState<string[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const commandTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nlpWorkerRef = useRef<Worker | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (!voiceConfig.enabled) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      announceToScreenReader('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = voiceConfig.continuous;
    recognition.interimResults = voiceConfig.interimResults;
    recognition.maxAlternatives = voiceConfig.maxAlternatives;
    recognition.lang = voiceConfig.language;

    recognition.onstart = () => {
      announceToScreenReader('Voice recognition started');
    };

    recognition.onresult = (event) => {
      handleSpeechResult(event);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      announceToScreenReader(`Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      if (isListening && voiceConfig.continuous) {
        recognition.start();
      }
    };

    setRecognition(recognition);

    return () => {
      recognition.stop();
    };
  }, [voiceConfig, isListening]);

  // Initialize audio analysis for voice level detection
  useEffect(() => {
    if (!voiceConfig.enabled) return;

    const initializeAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: voiceConfig.echoCancellation,
            noiseSuppression: voiceConfig.noiseReduction,
            autoGainControl: voiceConfig.autoGainControl
          }
        });

        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);

        microphoneRef.current.connect(analyserRef.current);
        analyserRef.current.fftSize = 256;

        updateVoiceLevel();
      } catch (error) {
        console.error('Failed to initialize audio:', error);
      }
    };

    initializeAudio();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [voiceConfig]);

  // Initialize NLP worker
  useEffect(() => {
    if (!nlpConfig.enabled) return;

    if (typeof Worker !== 'undefined') {
      nlpWorkerRef.current = new Worker('/workers/nlpProcessor.js');
      
      nlpWorkerRef.current.onmessage = (event) => {
        const { type, data } = event.data;
        
        switch (type) {
          case 'commandRecognized':
            handleNLPCommandRecognition(data);
            break;
          case 'intentExtracted':
            handleIntentExtraction(data);
            break;
          case 'error':
            console.error('NLP processing error:', data);
            break;
        }
      };

      // Send configuration to worker
      nlpWorkerRef.current.postMessage({
        type: 'configure',
        config: nlpConfig,
        commands: availableCommands
      });
    }

    return () => {
      if (nlpWorkerRef.current) {
        nlpWorkerRef.current.terminate();
      }
    };
  }, [nlpConfig, availableCommands]);

  const updateVoiceLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    setVoiceLevel(average / 255);

    if (voiceConfig.enabled) {
      requestAnimationFrame(updateVoiceLevel);
    }
  };

  const handleSpeechResult = (event: SpeechRecognitionEvent) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    setInterimTranscript(interimTranscript);
    onTranscriptionUpdate(interimTranscript, false);

    if (finalTranscript) {
      setCurrentTranscript(finalTranscript);
      onTranscriptionUpdate(finalTranscript, true);
      processVoiceCommand(finalTranscript);
    }
  };

  const processVoiceCommand = async (transcript: string) => {
    setIsProcessing(true);
    
    try {
      // Check for wake word if enabled
      if (voiceConfig.wakeWordEnabled && !wakeWordDetected) {
        if (transcript.toLowerCase().includes(voiceConfig.wakeWord.toLowerCase())) {
          setWakeWordDetected(true);
          announceToScreenReader('Wake word detected. Listening for commands.');
          
          // Set timeout for wake word session
          if (commandTimeoutRef.current) {
            clearTimeout(commandTimeoutRef.current);
          }
          
          commandTimeoutRef.current = setTimeout(() => {
            setWakeWordDetected(false);
            announceToScreenReader('Voice command session ended.');
          }, voiceConfig.commandTimeout);
          
          return;
        } else {
          return; // Ignore commands without wake word
        }
      }

      // Process command with NLP if enabled
      if (nlpConfig.enabled && nlpWorkerRef.current) {
        nlpWorkerRef.current.postMessage({
          type: 'processCommand',
          transcript,
          context: getCurrentContext()
        });
      } else {
        // Fallback to pattern matching
        const matchedCommand = matchCommandPattern(transcript);
        if (matchedCommand) {
          await executeVoiceCommand(matchedCommand.command, matchedCommand.parameters);
        } else {
          announceToScreenReader('Command not recognized. Say "help" for available commands.');
        }
      }

      // Add to command history
      setCommandHistory(prev => [...prev.slice(-9), transcript]);
      
    } catch (error) {
      console.error('Error processing voice command:', error);
      announceToScreenReader('Error processing voice command');
    } finally {
      setIsProcessing(false);
    }
  };

  const matchCommandPattern = (transcript: string): { command: VoiceCommand; parameters: VoiceParameters } | null => {
    const normalizedTranscript = transcript.toLowerCase().trim();
    
    for (const command of availableCommands) {
      if (!command.isEnabled) continue;
      
      for (const pattern of command.patterns) {
        const regex = new RegExp(pattern.replace(/\{(\w+)\}/g, '(.+)'), 'i');
        const match = normalizedTranscript.match(regex);
        
        if (match) {
          const parameters: VoiceParameters = {};
          
          // Extract parameters from pattern
          const paramNames = pattern.match(/\{(\w+)\}/g);
          if (paramNames) {
            paramNames.forEach((paramName, index) => {
              const cleanParamName = paramName.replace(/[{}]/g, '');
              parameters[cleanParamName] = match[index + 1];
            });
          }
          
          return { command, parameters };
        }
      }
      
      // Check aliases
      for (const alias of command.aliases) {
        if (normalizedTranscript.includes(alias.toLowerCase())) {
          return { command, parameters: {} };
        }
      }
    }
    
    return null;
  };

  const handleNLPCommandRecognition = (data: any) => {
    const { command, parameters, confidence } = data;
    
    if (confidence >= voiceConfig.confidenceThreshold) {
      executeVoiceCommand(command, parameters);
    } else {
      announceToScreenReader(`Command recognized with low confidence. Did you mean "${command.name}"?`);
    }
  };

  const handleIntentExtraction = (data: any) => {
    const { intent, entities, confidence } = data;
    
    // Find command matching the intent
    const matchingCommand = availableCommands.find(cmd => 
      cmd.name.toLowerCase().includes(intent.toLowerCase()) ||
      cmd.category === intent.toLowerCase()
    );
    
    if (matchingCommand && confidence >= voiceConfig.confidenceThreshold) {
      const parameters: VoiceParameters = {};
      
      // Map entities to command parameters
      entities.forEach((entity: any) => {
        parameters[entity.type] = entity.value;
      });
      
      executeVoiceCommand(matchingCommand, parameters);
    }
  };

  const executeVoiceCommand = async (command: VoiceCommand, parameters: VoiceParameters) => {
    try {
      if (voiceConfig.confirmationRequired && command.category !== 'system') {
        const confirmed = await requestConfirmation(command, parameters);
        if (!confirmed) {
          announceToScreenReader('Command cancelled');
          return;
        }
      }

      await command.action(parameters);
      onCommandExecuted(command, parameters);
      
      announceToScreenReader(`Executed command: ${command.name}`);
      
      // Reset wake word detection after successful command
      if (voiceConfig.wakeWordEnabled) {
        setWakeWordDetected(false);
        if (commandTimeoutRef.current) {
          clearTimeout(commandTimeoutRef.current);
        }
      }
      
    } catch (error) {
      console.error('Error executing voice command:', error);
      announceToScreenReader('Error executing command');
    }
  };

  const requestConfirmation = async (command: VoiceCommand, parameters: VoiceParameters): Promise<boolean> => {
    return new Promise((resolve) => {
      const paramStr = Object.keys(parameters).length > 0 
        ? ` with parameters: ${JSON.stringify(parameters)}`
        : '';
      
      announceToScreenReader(`Confirm execution of ${command.name}${paramStr}. Say "yes" to confirm or "no" to cancel.`);
      
      // Listen for confirmation
      const confirmationTimeout = setTimeout(() => {
        announceToScreenReader('Confirmation timeout. Command cancelled.');
        resolve(false);
      }, 5000);
      
      const handleConfirmation = (transcript: string) => {
        const normalized = transcript.toLowerCase().trim();
        
        if (normalized.includes('yes') || normalized.includes('confirm') || normalized.includes('ok')) {
          clearTimeout(confirmationTimeout);
          resolve(true);
        } else if (normalized.includes('no') || normalized.includes('cancel')) {
          clearTimeout(confirmationTimeout);
          resolve(false);
        }
      };
      
      // Temporarily override speech result handler
      if (recognition) {
        const originalHandler = recognition.onresult;
        recognition.onresult = (event) => {
          const transcript = event.results[event.results.length - 1][0].transcript;
          handleConfirmation(transcript);
          recognition.onresult = originalHandler;
        };
      }
    });
  };

  const getCurrentContext = () => {
    return {
      activeElement: document.activeElement?.tagName,
      url: window.location.href,
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };
  };

  const startListening = () => {
    if (recognition && voiceConfig.enabled) {
      recognition.start();
      onListeningChange(true);
    }
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
      onListeningChange(false);
    }
  };

  const announceToScreenReader = (message: string) => {
    setAnnouncements(prev => [...prev, message]);
    setTimeout(() => {
      setAnnouncements(prev => prev.slice(1));
    }, 1000);
  };

  return (
    <div className="voice-command-system">
      {/* Screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcements.map((announcement, index) => (
          <div key={index}>{announcement}</div>
        ))}
      </div>

      {/* Voice status indicator */}
      <div className="voice-status" role="status">
        <div className={`status-indicator ${isListening ? 'listening' : 'idle'} ${isProcessing ? 'processing' : ''}`}>
          {isListening && !isProcessing && '🎤'}
          {isProcessing && '⚙️'}
          {!isListening && !isProcessing && '🔇'}
        </div>
        
        <div className="status-text">
          {isProcessing && 'Processing...'}
          {isListening && !isProcessing && (wakeWordDetected ? 'Listening for command' : 'Listening for wake word')}
          {!isListening && 'Voice commands disabled'}
        </div>
        
        {isListening && (
          <div className="voice-level-indicator">
            <div 
              className="voice-level-bar"
              style={{ width: `${voiceLevel * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Current transcription */}
      {(currentTranscript || interimTranscript) && (
        <div className="transcription-display" role="log" aria-label="Voice transcription">
          <div className="final-transcript">{currentTranscript}</div>
          {interimTranscript && (
            <div className="interim-transcript">{interimTranscript}</div>
          )}
        </div>
      )}

      {/* Voice controls */}
      <div className="voice-controls" role="toolbar" aria-label="Voice command controls">
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={!voiceConfig.enabled}
          className={`voice-toggle ${isListening ? 'listening' : ''}`}
          aria-label={isListening ? 'Stop listening' : 'Start listening'}
        >
          {isListening ? 'Stop Listening' : 'Start Listening'}
        </button>
        
        <button
          onClick={() => {
            setWakeWordDetected(false);
            setCurrentTranscript('');
            setInterimTranscript('');
            announceToScreenReader('Voice session reset');
          }}
          className="reset-session"
        >
          Reset Session
        </button>
      </div>

      {/* Available commands help */}
      <details className="commands-help">
        <summary>Available Voice Commands</summary>
        <div className="commands-list">
          {availableCommands
            .filter(cmd => cmd.isEnabled)
            .sort((a, b) => a.category.localeCompare(b.category))
            .map(command => (
              <div key={command.id} className="command-item">
                <div className="command-header">
                  <h4>{command.name}</h4>
                  <span className="command-category">{command.category}</span>
                </div>
                <p className="command-description">{command.description}</p>
                <div className="command-examples">
                  <strong>Examples:</strong>
                  <ul>
                    {command.examples.map((example, index) => (
                      <li key={index}>"{example}"</li>
                    ))}
                  </ul>
                </div>
                {command.aliases.length > 0 && (
                  <div className="command-aliases">
                    <strong>Aliases:</strong> {command.aliases.join(', ')}
                  </div>
                )}
              </div>
            ))}
        </div>
      </details>

      {/* Command history */}
      {commandHistory.length > 0 && (
        <details className="command-history">
          <summary>Recent Commands</summary>
          <ul>
            {commandHistory.slice(-5).reverse().map((command, index) => (
              <li key={index}>{command}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};