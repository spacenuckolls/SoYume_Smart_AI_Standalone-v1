import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { debounce } from 'lodash';
import { Story, Scene, Character, CollaborationSession, UserPresence, EditOperation, Comment, Suggestion } from '../../shared/types/Story';

interface CollaborativeEditorProps {
  story: Story;
  scene: Scene;
  sessionId: string;
  userId: string;
  userName: string;
  userColor: string;
  onSceneUpdate: (scene: Scene, operation: EditOperation) => void;
  onPresenceUpdate: (presence: UserPresence) => void;
  onCommentAdd: (comment: Comment) => void;
  onSuggestionAdd: (suggestion: Suggestion) => void;
}

interface CollaboratorCursor {
  userId: string;
  userName: string;
  color: string;
  position: number;
  selection?: { start: number; end: number };
  lastSeen: Date;
}

interface ConflictResolution {
  id: string;
  type: 'merge' | 'overwrite' | 'manual';
  conflictingOperations: EditOperation[];
  resolution?: EditOperation;
  resolvedBy?: string;
  resolvedAt?: Date;
}

interface VersionHistory {
  version: number;
  content: string;
  author: string;
  timestamp: Date;
  operation: EditOperation;
  description: string;
}

interface RealTimeComment {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  content: string;
  position: number;
  timestamp: Date;
  resolved: boolean;
  replies: RealTimeComment[];
  thread: boolean;
}

interface LiveSuggestion {
  id: string;
  userId: string;
  userName: string;
  type: 'addition' | 'deletion' | 'modification' | 'restructure';
  originalText: string;
  suggestedText: string;
  position: number;
  length: number;
  reason: string;
  timestamp: Date;
  status: 'pending' | 'accepted' | 'rejected';
  votes: { userId: string; vote: 'accept' | 'reject' }[];
}

export const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({
  story,
  scene,
  sessionId,
  userId,
  userName,
  userColor,
  onSceneUpdate,
  onPresenceUpdate,
  onCommentAdd,
  onSuggestionAdd
}) => {
  const [content, setContent] = useState(scene.content || '');
  const [collaborators, setCollaborators] = useState<CollaboratorCursor[]>([]);
  const [comments, setComments] = useState<RealTimeComment[]>([]);
  const [suggestions, setSuggestions] = useState<LiveSuggestion[]>([]);
  const [conflicts, setConflicts] = useState<ConflictResolution[]>([]);
  const [versionHistory, setVersionHistory] = useState<VersionHistory[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [showComments, setShowComments] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [selectedText, setSelectedText] = useState<{ start: number; end: number } | null>(null);
  const [activeComment, setActiveComment] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [showConflictResolution, setShowConflictResolution] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const operationQueueRef = useRef<EditOperation[]>([]);
  const lastSyncedVersionRef = useRef<number>(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket connection management
  useEffect(() => {
    const connectWebSocket = () => {
      const wsUrl = `ws://localhost:3001/collaboration/${sessionId}`;
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        setConnectionStatus('connected');
        setIsConnected(true);
        
        // Send initial presence
        sendPresenceUpdate();
        
        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'heartbeat', userId }));
          }
        }, 30000);
      };
      
      wsRef.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      };
      
      wsRef.current.onclose = () => {
        setConnectionStatus('disconnected');
        setIsConnected(false);
        
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        
        // Attempt reconnection after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };
      
      wsRef.current.onerror = () => {
        setConnectionStatus('error');
      };
    };
    
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [sessionId, userId]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'operation':
        handleRemoteOperation(message.operation);
        break;
      case 'presence':
        updateCollaboratorPresence(message.presence);
        break;
      case 'comment':
        handleRemoteComment(message.comment);
        break;
      case 'suggestion':
        handleRemoteSuggestion(message.suggestion);
        break;
      case 'conflict':
        handleConflict(message.conflict);
        break;
      case 'version':
        updateVersionHistory(message.version);
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }, []);

  // Send presence updates
  const sendPresenceUpdate = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && textareaRef.current) {
      const presence: UserPresence = {
        userId,
        userName,
        userColor,
        sceneId: scene.id,
        cursorPosition: textareaRef.current.selectionStart,
        selection: selectedText,
        lastSeen: new Date(),
        isActive: document.hasFocus()
      };
      
      wsRef.current.send(JSON.stringify({
        type: 'presence',
        presence
      }));
      
      onPresenceUpdate(presence);
    }
  }, [userId, userName, userColor, scene.id, selectedText, onPresenceUpdate]);

  // Debounced presence updates
  const debouncedPresenceUpdate = useCallback(
    debounce(sendPresenceUpdate, 500),
    [sendPresenceUpdate]
  );

  // Handle content changes with operational transformation
  const handleContentChange = useCallback((newContent: string) => {
    const oldContent = content;
    setContent(newContent);
    
    // Create edit operation
    const operation: EditOperation = {
      id: `${userId}-${Date.now()}`,
      type: 'text-change',
      userId,
      timestamp: new Date(),
      position: cursorPosition,
      oldText: oldContent,
      newText: newContent,
      version: lastSyncedVersionRef.current + 1
    };
    
    // Add to operation queue
    operationQueueRef.current.push(operation);
    
    // Send operation to server
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'operation',
        operation
      }));
    }
    
    // Update scene
    const updatedScene = { ...scene, content: newContent };
    onSceneUpdate(updatedScene, operation);
    
    // Update presence
    debouncedPresenceUpdate();
  }, [content, cursorPosition, userId, scene, onSceneUpdate, debouncedPresenceUpdate]);

  // Handle remote operations with conflict resolution
  const handleRemoteOperation = useCallback((operation: EditOperation) => {
    if (operation.userId === userId) return; // Ignore own operations
    
    // Check for conflicts
    const conflictingOps = operationQueueRef.current.filter(op => 
      Math.abs(op.position - operation.position) < 10 && 
      Math.abs(op.timestamp.getTime() - operation.timestamp.getTime()) < 5000
    );
    
    if (conflictingOps.length > 0) {
      // Handle conflict
      const conflict: ConflictResolution = {
        id: `conflict-${Date.now()}`,
        type: 'merge',
        conflictingOperations: [operation, ...conflictingOps]
      };
      
      setConflicts(prev => [...prev, conflict]);
      setShowConflictResolution(true);
    } else {
      // Apply operation directly
      applyOperation(operation);
    }
  }, [userId]);

  // Apply operation to content
  const applyOperation = useCallback((operation: EditOperation) => {
    if (operation.type === 'text-change') {
      setContent(operation.newText);
      
      // Update version history
      const historyEntry: VersionHistory = {
        version: operation.version,
        content: operation.newText,
        author: operation.userId,
        timestamp: operation.timestamp,
        operation,
        description: `Text change by ${operation.userId}`
      };
      
      setVersionHistory(prev => [...prev, historyEntry]);
      lastSyncedVersionRef.current = operation.version;
    }
  }, []);

  // Update collaborator presence
  const updateCollaboratorPresence = useCallback((presence: UserPresence) => {
    setCollaborators(prev => {
      const existing = prev.find(c => c.userId === presence.userId);
      if (existing) {
        return prev.map(c => c.userId === presence.userId ? {
          ...c,
          position: presence.cursorPosition,
          selection: presence.selection,
          lastSeen: presence.lastSeen
        } : c);
      } else {
        return [...prev, {
          userId: presence.userId,
          userName: presence.userName,
          color: presence.userColor,
          position: presence.cursorPosition,
          selection: presence.selection,
          lastSeen: presence.lastSeen
        }];
      }
    });
  }, []);

  // Handle remote comments
  const handleRemoteComment = useCallback((comment: RealTimeComment) => {
    setComments(prev => {
      if (comment.thread && comment.replies) {
        // Update existing thread
        return prev.map(c => 
          c.id === comment.id ? { ...c, replies: comment.replies } : c
        );
      } else {
        // Add new comment
        return [...prev, comment];
      }
    });
  }, []);

  // Handle remote suggestions
  const handleRemoteSuggestion = useCallback((suggestion: LiveSuggestion) => {
    setSuggestions(prev => {
      const existing = prev.find(s => s.id === suggestion.id);
      if (existing) {
        return prev.map(s => s.id === suggestion.id ? suggestion : s);
      } else {
        return [...prev, suggestion];
      }
    });
  }, []);

  // Handle conflicts
  const handleConflict = useCallback((conflict: ConflictResolution) => {
    setConflicts(prev => [...prev, conflict]);
    setShowConflictResolution(true);
  }, []);

  // Add comment
  const addComment = useCallback((position: number, text: string) => {
    const comment: RealTimeComment = {
      id: `comment-${userId}-${Date.now()}`,
      userId,
      userName,
      userColor,
      content: text,
      position,
      timestamp: new Date(),
      resolved: false,
      replies: [],
      thread: false
    };
    
    setComments(prev => [...prev, comment]);
    
    // Send to server
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'comment',
        comment
      }));
    }
    
    onCommentAdd({
      id: comment.id,
      content: comment.content,
      position: comment.position,
      author: comment.userName,
      timestamp: comment.timestamp,
      resolved: comment.resolved
    });
  }, [userId, userName, userColor, onCommentAdd]);

  // Add suggestion
  const addSuggestion = useCallback((
    type: LiveSuggestion['type'],
    originalText: string,
    suggestedText: string,
    position: number,
    length: number,
    reason: string
  ) => {
    const suggestion: LiveSuggestion = {
      id: `suggestion-${userId}-${Date.now()}`,
      userId,
      userName,
      type,
      originalText,
      suggestedText,
      position,
      length,
      reason,
      timestamp: new Date(),
      status: 'pending',
      votes: []
    };
    
    setSuggestions(prev => [...prev, suggestion]);
    
    // Send to server
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'suggestion',
        suggestion
      }));
    }
    
    onSuggestionAdd({
      id: suggestion.id,
      type: suggestion.type,
      originalText: suggestion.originalText,
      suggestedText: suggestion.suggestedText,
      position: suggestion.position,
      reason: suggestion.reason,
      author: suggestion.userName,
      timestamp: suggestion.timestamp,
      status: suggestion.status
    });
  }, [userId, userName, onSuggestionAdd]);

  // Handle text selection
  const handleSelectionChange = useCallback(() => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      
      setCursorPosition(start);
      
      if (start !== end) {
        setSelectedText({ start, end });
      } else {
        setSelectedText(null);
      }
      
      debouncedPresenceUpdate();
    }
  }, [debouncedPresenceUpdate]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl/Cmd + M: Add comment
    if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
      e.preventDefault();
      if (selectedText) {
        setActiveComment('new');
      }
    }
    
    // Ctrl/Cmd + Shift + S: Add suggestion
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      if (selectedText) {
        const selected = content.substring(selectedText.start, selectedText.end);
        addSuggestion('modification', selected, '', selectedText.start, selectedText.end - selectedText.start, 'User suggestion');
      }
    }
    
    // Escape: Cancel active comment/suggestion
    if (e.key === 'Escape') {
      setActiveComment(null);
      setNewCommentText('');
    }
  }, [selectedText, content, addSuggestion]);

  // Resolve conflict
  const resolveConflict = useCallback((conflictId: string, resolution: 'accept' | 'reject' | 'merge') => {
    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict) return;
    
    let resolvedOperation: EditOperation;
    
    switch (resolution) {
      case 'accept':
        resolvedOperation = conflict.conflictingOperations[0]; // Accept remote operation
        break;
      case 'reject':
        resolvedOperation = conflict.conflictingOperations[1]; // Keep local operation
        break;
      case 'merge':
        // Create merged operation
        resolvedOperation = {
          ...conflict.conflictingOperations[0],
          id: `merged-${Date.now()}`,
          newText: mergeOperations(conflict.conflictingOperations)
        };
        break;
      default:
        return;
    }
    
    // Apply resolved operation
    applyOperation(resolvedOperation);
    
    // Remove conflict
    setConflicts(prev => prev.filter(c => c.id !== conflictId));
    
    // Send resolution to server
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'conflict-resolution',
        conflictId,
        resolution: resolvedOperation,
        resolvedBy: userId
      }));
    }
  }, [conflicts, userId, applyOperation]);

  // Vote on suggestion
  const voteOnSuggestion = useCallback((suggestionId: string, vote: 'accept' | 'reject') => {
    setSuggestions(prev => prev.map(s => {
      if (s.id === suggestionId) {
        const existingVote = s.votes.find(v => v.userId === userId);
        let newVotes;
        
        if (existingVote) {
          newVotes = s.votes.map(v => v.userId === userId ? { ...v, vote } : v);
        } else {
          newVotes = [...s.votes, { userId, vote }];
        }
        
        // Auto-accept if majority votes accept
        const acceptVotes = newVotes.filter(v => v.vote === 'accept').length;
        const rejectVotes = newVotes.filter(v => v.vote === 'reject').length;
        
        let newStatus = s.status;
        if (acceptVotes > rejectVotes && acceptVotes >= Math.ceil(collaborators.length / 2)) {
          newStatus = 'accepted';
          // Apply suggestion
          const newContent = content.substring(0, s.position) + 
                           s.suggestedText + 
                           content.substring(s.position + s.length);
          handleContentChange(newContent);
        } else if (rejectVotes > acceptVotes && rejectVotes >= Math.ceil(collaborators.length / 2)) {
          newStatus = 'rejected';
        }
        
        return { ...s, votes: newVotes, status: newStatus };
      }
      return s;
    }));
    
    // Send vote to server
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'suggestion-vote',
        suggestionId,
        userId,
        vote
      }));
    }
  }, [userId, collaborators.length, content, handleContentChange]);

  // Render collaborator cursors
  const renderCollaboratorCursors = useMemo(() => {
    if (!textareaRef.current) return null;
    
    return collaborators.map(collaborator => {
      if (collaborator.userId === userId) return null;
      
      const textarea = textareaRef.current!;
      const textBeforeCursor = content.substring(0, collaborator.position);
      const lines = textBeforeCursor.split('\n');
      const lineNumber = lines.length - 1;
      const columnNumber = lines[lines.length - 1].length;
      
      // Calculate cursor position (simplified)
      const lineHeight = 20; // Approximate line height
      const charWidth = 8; // Approximate character width
      
      const top = lineNumber * lineHeight;
      const left = columnNumber * charWidth;
      
      return (
        <div
          key={collaborator.userId}
          className="collaborator-cursor"
          style={{
            position: 'absolute',
            top: `${top}px`,
            left: `${left}px`,
            borderLeft: `2px solid ${collaborator.color}`,
            height: `${lineHeight}px`,
            pointerEvents: 'none',
            zIndex: 1000
          }}
        >
          <div
            className="collaborator-label"
            style={{
              backgroundColor: collaborator.color,
              color: 'white',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '12px',
              whiteSpace: 'nowrap',
              transform: 'translateY(-100%)'
            }}
          >
            {collaborator.userName}
          </div>
        </div>
      );
    });
  }, [collaborators, userId, content]);

  return (
    <div className="collaborative-editor">
      <div className="editor-header">
        <div className="connection-status">
          <div className={`status-indicator ${connectionStatus}`} />
          <span>{connectionStatus}</span>
        </div>
        
        <div className="collaborators-list">
          {collaborators.map(collaborator => (
            <div 
              key={collaborator.userId}
              className="collaborator-avatar"
              style={{ backgroundColor: collaborator.color }}
              title={collaborator.userName}
            >
              {collaborator.userName.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
        
        <div className="editor-controls">
          <button 
            className={`btn-toggle ${showComments ? 'active' : ''}`}
            onClick={() => setShowComments(!showComments)}
          >
            Comments ({comments.length})
          </button>
          
          <button 
            className={`btn-toggle ${showSuggestions ? 'active' : ''}`}
            onClick={() => setShowSuggestions(!showSuggestions)}
          >
            Suggestions ({suggestions.filter(s => s.status === 'pending').length})
          </button>
          
          <button 
            className={`btn-toggle ${showVersionHistory ? 'active' : ''}`}
            onClick={() => setShowVersionHistory(!showVersionHistory)}
          >
            History
          </button>
        </div>
      </div>
      
      <div className="editor-content">
        <div className="editor-main">
          <div className="editor-container">
            <textarea
              ref={textareaRef}
              className="collaborative-textarea"
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onSelect={handleSelectionChange}
              onKeyDown={handleKeyDown}
              placeholder="Start writing collaboratively..."
              spellCheck={true}
            />
            
            <div className="cursor-overlay">
              {renderCollaboratorCursors}
            </div>
          </div>
        </div>
        
        <div className="editor-sidebar">
          {showComments && (
            <div className="comments-panel">
              <div className="panel-header">
                <h3>Comments</h3>
                <button onClick={() => setShowComments(false)}>×</button>
              </div>
              
              <div className="comments-list">
                {comments.map(comment => (
                  <div key={comment.id} className={`comment-item ${comment.resolved ? 'resolved' : ''}`}>
                    <div className="comment-header">
                      <div 
                        className="comment-author"
                        style={{ color: comment.userColor }}
                      >
                        {comment.userName}
                      </div>
                      <div className="comment-timestamp">
                        {comment.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                    
                    <div className="comment-content">
                      {comment.content}
                    </div>
                    
                    <div className="comment-actions">
                      <button 
                        className="btn-sm"
                        onClick={() => {
                          setComments(prev => prev.map(c => 
                            c.id === comment.id ? { ...c, resolved: !c.resolved } : c
                          ));
                        }}
                      >
                        {comment.resolved ? 'Unresolve' : 'Resolve'}
                      </button>
                      
                      <button 
                        className="btn-sm"
                        onClick={() => {
                          if (textareaRef.current) {
                            textareaRef.current.focus();
                            textareaRef.current.setSelectionRange(comment.position, comment.position);
                          }
                        }}
                      >
                        Go to
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {activeComment === 'new' && (
                <div className="new-comment">
                  <textarea
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    rows={3}
                  />
                  <div className="comment-actions">
                    <button 
                      className="btn-primary btn-sm"
                      onClick={() => {
                        if (newCommentText.trim() && selectedText) {
                          addComment(selectedText.start, newCommentText.trim());
                          setNewCommentText('');
                          setActiveComment(null);
                        }
                      }}
                    >
                      Add Comment
                    </button>
                    <button 
                      className="btn-secondary btn-sm"
                      onClick={() => {
                        setActiveComment(null);
                        setNewCommentText('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper functions
function mergeOperations(operations: EditOperation[]): string {
  // Simple merge strategy - could be more sophisticated
  const sortedOps = operations.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return sortedOps[sortedOps.length - 1].newText;
}

function updateVersionHistory(version: any) {
  // Implementation for updating version history from server
  console.log('Version history update:', version);
}