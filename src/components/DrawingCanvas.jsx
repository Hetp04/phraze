import React, { useState, useRef, useEffect, useCallback } from 'react';
import { saveFirebaseData, getFirebaseData } from '../funcs';
import { auth } from '../firebase-init';

// Helper function to get the correct Firebase path for a chat based on public/private status
// SECURITY: Private chats are stored in a separate path that's server-enforced to be owner-only
function getChatBasePath(companyEmail, projectId, chatId, isPrivate, userEmail) {
  const formattedCompanyEmail = companyEmail.replace(/\./g, ',');
  if (isPrivate && userEmail) {
    const userEmailFormatted = userEmail.replace(/\./g, ',');
    return `Companies/${formattedCompanyEmail}/projects/${projectId}/privateChats/${userEmailFormatted}/${chatId}`;
  }
  return `Companies/${formattedCompanyEmail}/projects/${projectId}/groqChats/${chatId}`;
}

const DrawingCanvas = ({ messageId, chatId, companyEmail, currentProject, onClose, position, existingDrawing, onDrawingUpdate, isSharedView, originalChatId, sharedCompanyEmail, isPrivateChat }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [currentStroke, setCurrentStroke] = useState([]);
  
  // Mode toggle state
  const [mode, setMode] = useState('draw'); // 'draw' or 'text'
  
  // Text content state
  const [textContent, setTextContent] = useState('');
  const [savedNotes, setSavedNotes] = useState([]);
  const [editingNoteId, setEditingNoteId] = useState(null);
  
  // Refs
  const notesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  
  // Drawing settings
  const strokeColor = '#ff6b6b'; // Fixed red color
  const strokeWidth = 3;

  // Load existing drawings from props
  useEffect(() => {
    if (existingDrawing && existingDrawing.strokes && existingDrawing.strokes.length > 0) {
      setStrokes(existingDrawing.strokes);
      setUndoStack([existingDrawing.strokes]);
      redrawCanvas(existingDrawing.strokes);
    } else {
      // Initialize with empty state if no existing drawing
      setStrokes([]);
      setUndoStack([[]]);
      setRedoStack([]);
    }
  }, [existingDrawing]);

  // Redraw canvas with all strokes
  const redrawCanvas = useCallback((strokesToRedraw = strokes) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set canvas properties
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;

    // Draw all strokes
    strokesToRedraw.forEach(stroke => {
      if (stroke.length > 1) {
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        stroke.forEach(point => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
      }
    });
  }, [strokes, strokeColor, strokeWidth]);

  // Save drawing to Firebase
  const saveDrawing = useCallback(async (strokesToSave = strokes) => {
    // Don't save if user is not logged in
    if (!auth.currentUser) return;

    try {
      // Determine the correct path and company email for saving
      let targetChatId = chatId;
      let targetCompanyEmail = companyEmail;
      
      // For shared chats, save to the original chat location
      if (isSharedView && originalChatId) {
        targetChatId = originalChatId;
        targetCompanyEmail = sharedCompanyEmail || companyEmail;
      } else if (!targetCompanyEmail && auth.currentUser) {
        // If no companyEmail (different port), fetch from Firebase
        const userEmail = auth.currentUser.email.replace('.', ',');
        targetCompanyEmail = await getFirebaseData(`emailToCompanyDirectory/${userEmail}`);
        console.log('Fetched companyEmail for saving:', targetCompanyEmail);
      }
      
      if (!targetCompanyEmail || !targetChatId || !messageId) {
        console.error('Missing required data for saving drawing:', {
          targetCompanyEmail,
          targetChatId,
          messageId,
          isSharedView,
          originalChatId,
          sharedCompanyEmail,
          userEmail: auth.currentUser?.email
        });
        return;
      }

      // Use correct path based on chat's public/private status
      const chatBasePath = getChatBasePath(targetCompanyEmail, currentProject, targetChatId, isPrivateChat && !isSharedView, auth.currentUser?.email);
      const drawingPath = `${chatBasePath}/drawings/${messageId}`;
      const drawingData = {
        strokes: strokesToSave,
        position: position,
        timestamp: Date.now(),
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email
      };
      
      console.log('Saving drawing to Firebase:', {
        path: drawingPath,
        strokeCount: strokesToSave.length,
        userId: auth.currentUser.uid
      });
      
      await saveFirebaseData(drawingPath, drawingData);
      
      // Update parent component with new drawing data
      if (onDrawingUpdate) {
        onDrawingUpdate(messageId, drawingData);
      }
      
      console.log('Drawing saved successfully to Firebase');
    } catch (error) {
      console.error('Error saving drawing:', error);
    }
  }, [messageId, chatId, companyEmail, currentProject, position, onDrawingUpdate, isSharedView, originalChatId, sharedCompanyEmail, strokes]);

  // Get mouse position relative to canvas
  const getMousePos = useCallback((canvas, e) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }, []);

  // Start drawing
  const startDrawing = useCallback((e) => {
    // Don't allow drawing if user is not logged in
    if (!auth.currentUser) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    const pos = getMousePos(canvas, e);
    setCurrentStroke([pos]);
    
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, [getMousePos, strokeColor, strokeWidth]);

  // Continue drawing
  const draw = useCallback((e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pos = getMousePos(canvas, e);
    setCurrentStroke(prev => [...prev, pos]);
    
    const ctx = canvas.getContext('2d');
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }, [isDrawing, getMousePos]);

  // Stop drawing
  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    
    if (currentStroke.length > 1) {
      const newStrokes = [...strokes, currentStroke];
      setStrokes(newStrokes);
      setUndoStack(prev => [...prev, newStrokes]);
      setRedoStack([]); // Clear redo stack when new stroke is added
      saveDrawing(newStrokes);
    }
    
    setCurrentStroke([]);
  }, [isDrawing, currentStroke, strokes, saveDrawing]);

  // Undo function
  const undo = useCallback(() => {
    if (undoStack.length <= 1) return;

    const newUndoStack = [...undoStack];
    const currentState = newUndoStack.pop();
    const previousState = newUndoStack[newUndoStack.length - 1] || [];
    
    setRedoStack(prev => [...prev, currentState]);
    setUndoStack(newUndoStack);
    setStrokes(previousState);
    
    redrawCanvas(previousState);
    saveDrawing(previousState);
  }, [undoStack, redrawCanvas, saveDrawing]);

  // Redo function
  const redo = useCallback(() => {
    if (redoStack.length === 0) return;

    const newRedoStack = [...redoStack];
    const nextState = newRedoStack.pop();
    
    setUndoStack(prev => [...prev, nextState]);
    setRedoStack(newRedoStack);
    setStrokes(nextState);
    
    redrawCanvas(nextState);
    saveDrawing(nextState);
  }, [redoStack, redrawCanvas, saveDrawing]);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    const newStrokes = [];
    setStrokes(newStrokes);
    setUndoStack([newStrokes]);
    setRedoStack([]);
    redrawCanvas(newStrokes);
    saveDrawing(newStrokes);
  }, [redrawCanvas, saveDrawing]);

  // Mode toggle function
  const toggleMode = useCallback(() => {
    setMode(prevMode => {
      const newMode = prevMode === 'draw' ? 'text' : 'draw';
      // If switching to draw mode, redraw the canvas
      if (newMode === 'draw') {
        setTimeout(() => {
          redrawCanvas();
        }, 0);
      }
      return newMode;
    });
  }, [redrawCanvas]);




  // Load saved notes when component mounts or mode changes to text
  useEffect(() => {
    if (mode === 'text') {
      const loadSavedNotes = async () => {
        try {
          if (auth.currentUser && messageId) {
            let targetChatId = chatId;
            let targetCompanyEmail = companyEmail;
            
            if (isSharedView && originalChatId) {
              targetChatId = originalChatId;
              targetCompanyEmail = sharedCompanyEmail || companyEmail;
            } else if (!targetCompanyEmail && auth.currentUser) {
              const userEmail = auth.currentUser.email.replace('.', ',');
              targetCompanyEmail = await getFirebaseData(`emailToCompanyDirectory/${userEmail}`);
            }
            
            if (targetCompanyEmail && targetChatId) {
              const notesPath = `Companies/${targetCompanyEmail}/projects/${currentProject}/groqChats/${targetChatId}/notes/${messageId}`;
              const notesData = await getFirebaseData(notesPath);
              if (notesData) {
                // Convert Firebase object to array and sort by timestamp
                const notesArray = Object.keys(notesData).map(key => ({
                  id: key,
                  ...notesData[key]
                })).sort((a, b) => b.timestamp - a.timestamp);
                setSavedNotes(notesArray);
              } else {
                setSavedNotes([]);
              }
            }
          }
        } catch (error) {
          console.error('Error loading saved notes:', error);
        }
      };
      
      loadSavedNotes();
    }
  }, [mode, messageId, chatId, companyEmail, currentProject, auth.currentUser, isSharedView, originalChatId, sharedCompanyEmail]);

  // Save note to Firebase
  const saveNote = useCallback(async () => {
    if (!auth.currentUser || !textContent.trim()) return;

    try {
      let targetChatId = chatId;
      let targetCompanyEmail = companyEmail;
      
      if (isSharedView && originalChatId) {
        targetChatId = originalChatId;
        targetCompanyEmail = sharedCompanyEmail || companyEmail;
      } else if (!targetCompanyEmail && auth.currentUser) {
        const userEmail = auth.currentUser.email.replace('.', ',');
        targetCompanyEmail = await getFirebaseData(`emailToCompanyDirectory/${userEmail}`);
      }
      
      if (!targetCompanyEmail || !targetChatId || !messageId) {
        console.error('Missing required data for saving note');
        return;
      }

      const noteId = editingNoteId || `note_${Date.now()}`;
      const notesPath = `Companies/${targetCompanyEmail}/projects/${currentProject}/groqChats/${targetChatId}/notes/${messageId}/${noteId}`;
      const noteData = {
        content: textContent,
        timestamp: Date.now(),
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        isEdited: !!editingNoteId
      };
      
      await saveFirebaseData(notesPath, noteData);
      
      // Batch all state updates together to prevent glitches
      if (editingNoteId) {
        setSavedNotes(prev => prev.map(note => 
          note.id === editingNoteId 
            ? { ...note, content: textContent, timestamp: Date.now(), isEdited: true }
            : note
        ));
        setEditingNoteId(null);
        setTextContent('');
      } else {
        const newNote = { id: noteId, ...noteData };
        setSavedNotes(prev => [newNote, ...prev]);
        setTextContent('');
      }
      
      // Simple focus without timeout to prevent glitches
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
      
      console.log('Note saved successfully to Firebase');
    } catch (error) {
      console.error('Error saving note:', error);
    }
  }, [textContent, editingNoteId, messageId, chatId, companyEmail, currentProject, auth.currentUser, isSharedView, originalChatId, sharedCompanyEmail]);

  // Edit existing note
  const editNote = useCallback((note) => {
    setTextContent(note.content);
    setEditingNoteId(note.id);
    
    // Simple focus and scroll without timeout
    if (textareaRef.current) {
      textareaRef.current.scrollTop = 0;
      textareaRef.current.focus();
    }
  }, []);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setTextContent('');
    setEditingNoteId(null);
    
    // Simple focus without timeout
    if (notesContainerRef.current) {
      notesContainerRef.current.focus();
    }
  }, []);

  // Handle keyboard navigation in notes
  const handleNotesKeyDown = useCallback((e) => {
    if (!notesContainerRef.current) return;
    
    const container = notesContainerRef.current;
    const scrollAmount = 50; // pixels to scroll
    
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        container.scrollTop -= scrollAmount;
        break;
      case 'ArrowDown':
        e.preventDefault();
        container.scrollTop += scrollAmount;
        break;
      case 'PageUp':
        e.preventDefault();
        container.scrollTop -= container.clientHeight * 0.8;
        break;
      case 'PageDown':
        e.preventDefault();
        container.scrollTop += container.clientHeight * 0.8;
        break;
      case 'Home':
        e.preventDefault();
        container.scrollTop = 0;
        break;
      case 'End':
        e.preventDefault();
        container.scrollTop = container.scrollHeight;
        break;
    }
  }, []);

  // Handle wheel events for touchpad scrolling
  const handleWheel = useCallback((e) => {
    if (!notesContainerRef.current) return;
    
    const container = notesContainerRef.current;
    e.preventDefault();
    
    // Use deltaY for touchpad scrolling
    container.scrollTop += e.deltaY;
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (e.key === 'z' && e.shiftKey || e.key === 'y') {
          e.preventDefault();
          redo();
        }
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, onClose]);

  return (
    <div className="drawing-canvas" style={{
      position: 'absolute',
      top: position.top,
      left: position.left,
      zIndex: 1001,
      background: 'white',
      border: '2px solid #e5e7eb',
      borderRadius: '12px',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      width: '432px' // 400px canvas + 16px padding on each side
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '12px',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {/* Mode Toggle Switch - Minimal Grey Boxes */}
          <div
            style={{
              display: 'flex',
              gap: '2px',
              opacity: auth.currentUser ? 1 : 0.5,
              cursor: auth.currentUser ? 'pointer' : 'not-allowed'
            }}
            onClick={auth.currentUser ? toggleMode : undefined}
            title={auth.currentUser ? 'Switch between Draw and Text modes' : 'Login to edit'}
          >
            {/* Draw Option */}
            <div
              style={{
                padding: '6px 20px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: '500',
                color: mode === 'draw' ? '#374151' : '#9ca3af',
                background: mode === 'draw' ? '#f3f4f6' : '#ffffff',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                minWidth: '100px',
                justifyContent: 'center',
                border: '1px solid #e5e7eb'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
              </svg>
              Draw
            </div>
            
            {/* Text Option */}
            <div
              style={{
                padding: '6px 20px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: '500',
                color: mode === 'text' ? '#374151' : '#9ca3af',
                background: mode === 'text' ? '#f3f4f6' : '#ffffff',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                minWidth: '100px',
                justifyContent: 'center',
                border: '1px solid #e5e7eb'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
                <path d="M3 3h18M3 9h18M3 15h18M3 21h18"/>
              </svg>
              Text
            </div>
          </div>
          
          {!auth.currentUser && (
            <span style={{ 
              fontSize: '12px', 
              color: '#9ca3af',
              fontStyle: 'italic'
            }}>
              View Only (Login to edit)
            </span>
          )}
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <button
            onClick={undo}
            disabled={!auth.currentUser || undoStack.length <= 1}
            style={{
              padding: '6px',
              background: 'none',
              border: 'none',
              borderRadius: '6px',
              cursor: (!auth.currentUser || undoStack.length <= 1) ? 'not-allowed' : 'pointer',
              color: (!auth.currentUser || undoStack.length <= 1) ? '#9ca3af' : '#374151',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={auth.currentUser ? "Undo (Ctrl+Z)" : "Login to edit"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v6h6"/>
              <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
            </svg>
          </button>
          
          <button
            onClick={redo}
            disabled={!auth.currentUser || redoStack.length === 0}
            style={{
              padding: '6px',
              background: 'none',
              border: 'none',
              borderRadius: '6px',
              cursor: (!auth.currentUser || redoStack.length === 0) ? 'not-allowed' : 'pointer',
              color: (!auth.currentUser || redoStack.length === 0) ? '#9ca3af' : '#374151',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={auth.currentUser ? "Redo (Ctrl+Y)" : "Login to edit"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 7v6h-6"/>
              <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3-2.3"/>
            </svg>
          </button>
          
          <button
            onClick={clearCanvas}
            disabled={!auth.currentUser}
            style={{
              padding: '6px',
              background: 'none',
              border: 'none',
              borderRadius: '6px',
              cursor: auth.currentUser ? 'pointer' : 'not-allowed',
              color: auth.currentUser ? '#374151' : '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={auth.currentUser ? "Clear all" : "Login to edit"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18"/>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
          </button>
          
          <button
            onClick={onClose}
            style={{
              padding: '6px',
              background: 'none',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#374151',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Close (Esc)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Canvas or Category Management */}
      <div style={{ 
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        {mode === 'draw' ? (
          <canvas
            ref={canvasRef}
            width={400}
            height={300}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              cursor: auth.currentUser ? 'crosshair' : 'default',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              display: 'block',
              margin: '0 auto'
            }}
            onMouseDown={auth.currentUser ? startDrawing : undefined}
            onMouseMove={auth.currentUser ? draw : undefined}
            onMouseUp={auth.currentUser ? stopDrawing : undefined}
            onMouseLeave={auth.currentUser ? stopDrawing : undefined}
          />
        ) : (
            <div style={{
              width: '400px',
              height: '320px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '16px',
            backgroundColor: 'white',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflow: 'hidden'
          }}>


            {/* Text Editor */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              flex: 1,
              minHeight: 0
            }}>
              {/* New Note Input */}
                <div>
                  <textarea
                    ref={textareaRef}
                    value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder={auth.currentUser ? (editingNoteId ? "Editing note..." : "Type your note here...") : "Login to add notes"}
                  disabled={!auth.currentUser}
                  style={{
                    width: '100%',
                    height: '120px',
                    padding: '12px',
                    border: '1px solid #e5e5e5',
                    borderRadius: '8px',
                    backgroundColor: auth.currentUser ? 'white' : '#f3f3f3',
                    fontSize: '14px',
                    color: auth.currentUser ? '#374151' : '#9ca3af',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    lineHeight: '1.5',
                    cursor: auth.currentUser ? 'text' : 'not-allowed'
                  }}
                  onFocus={(e) => {
                    if (auth.currentUser) {
                      e.target.style.borderColor = '#d1d5db';
                    }
                  }}
                  onBlur={(e) => {
                    if (auth.currentUser) {
                      e.target.style.borderColor = '#e5e5e5';
                    }
                  }}
                />
                
                {/* Action Buttons */}
                {auth.currentUser && textContent.trim() && (
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginTop: '8px',
                    justifyContent: 'flex-end'
                  }}>
                    {editingNoteId && (
                      <button
                        onClick={cancelEditing}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #e5e5e5',
                          borderRadius: '6px',
                          backgroundColor: '#f3f3f3',
                          fontSize: '12px',
                          color: '#6b7280',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#e5e5e5';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = '#f3f3f3';
                        }}
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={saveNote}
                      style={{
                        padding: '6px 12px',
                        border: '1px solid #e5e5e5',
                        borderRadius: '6px',
                        backgroundColor: '#f7f7f8',
                        fontSize: '12px',
                        color: '#374151',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#e5e5e5';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = '#f7f7f8';
                      }}
                    >
                      {editingNoteId ? 'Update Note' : 'Save Note'}
                    </button>
                  </div>
                )}
              </div>

              {/* Notes History */}
              {savedNotes.length > 0 && (
                <div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Saved Notes ({savedNotes.length})
                  </div>
                  <div 
                    ref={notesContainerRef}
                    tabIndex={0}
                    style={{
                      maxHeight: '200px',
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      border: '1px solid #e5e5e5',
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      scrollbarWidth: 'thin',
                      scrollbarColor: '#cbd5e0 #f7fafc',
                      WebkitOverflowScrolling: 'touch',
                      outline: 'none',
                      // Ensure touchpad scrolling works
                      touchAction: 'pan-y',
                      overscrollBehavior: 'contain'
                    }}
                    onKeyDown={handleNotesKeyDown}
                    onWheel={handleWheel}
                    onClick={(e) => {
                      // Only focus if clicking on empty space, not on a note
                      if (e.target === e.currentTarget) {
                        notesContainerRef.current?.focus();
                      }
                    }}
                  >
                    {savedNotes.map((note, index) => (
                      <div
                        key={note.id}
                        style={{
                          padding: '12px',
                          borderBottom: index < savedNotes.length - 1 ? '1px solid #f3f4f6' : 'none',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s ease',
                          backgroundColor: '#ffffff',
                          margin: '0',
                          border: 'none'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#ffffff';
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          editNote(note);
                        }}
                      >
                        <div style={{
                          fontSize: '13px',
                          color: '#6b7280',
                          marginBottom: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          pointerEvents: 'none'
                        }}>
                          <span>
                            {new Date(note.timestamp).toLocaleString()}
                            {note.isEdited && <span style={{ color: '#059669', marginLeft: '4px' }}>(edited)</span>}
                          </span>
                          <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                            Click to edit
                          </span>
                        </div>
                        <div style={{
                          fontSize: '14px',
                          color: '#374151',
                          lineHeight: '1.4',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          pointerEvents: 'none'
                        }}>
                          {note.content.length > 100 
                            ? `${note.content.substring(0, 100)}...` 
                            : note.content
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
      
      <div style={{
        fontSize: '12px',
        color: '#9ca3af',
        textAlign: 'center',
        paddingTop: '4px'
      }}>
        {auth.currentUser 
          ? (mode === 'draw' 
              ? 'Draw freely • Use toggle to switch modes • Ctrl+Z to undo • Esc to close'
              : 'Type your notes • Save note on blur • Click saved notes to edit • Esc to close'
            )
          : (mode === 'draw' 
              ? 'View existing drawings • Login to edit • Esc to close'
              : 'View notes • Login to edit • Esc to close'
            )
        }
      </div>
    </div>
  );
};

export default DrawingCanvas;
