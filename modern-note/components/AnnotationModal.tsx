import React, { useState, useRef, useEffect } from 'react';
import { 
  XIcon, 
  BoldIcon, 
  ItalicIcon, 
  ImageIcon, 
  PaletteIcon, 
  PlusIcon,
  SendIcon
} from './Icons';

interface AnnotationModalProps {
  onClose: () => void;
  isOpen: boolean;
}

interface Note {
  id: string;
  content: string;
  createdAt: Date;
}

const AnnotationModal: React.FC<AnnotationModalProps> = ({ onClose, isOpen }) => {
  const [text, setText] = useState('');
  const [labels, setLabels] = useState<string[]>(['Urgent']);
  const [notes, setNotes] = useState<Note[]>([
    { id: '1', content: 'Needs review by Friday.', createdAt: new Date(Date.now() - 3600000) }
  ]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notesEndRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  // Scroll to bottom of notes when added
  useEffect(() => {
    if (notesEndRef.current) {
      notesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [notes]);

  const addLabel = (label: string) => {
    if (!labels.includes(label)) {
      setLabels([...labels, label]);
    }
    setIsDropdownOpen(false);
  };

  const removeLabel = (labelToRemove: string) => {
    setLabels(labels.filter(l => l !== labelToRemove));
  };

  const handleAddNote = () => {
    if (!text.trim()) return;
    
    const newNote: Note = {
      id: Date.now().toString(),
      content: text.trim(),
      createdAt: new Date()
    };
    
    setNotes([...notes, newNote]);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddNote();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      {/* Backdrop */}
      <div 
        className="modal-backdrop" 
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="modal-content">
        
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Annotations</h2>
          <button 
            onClick={onClose}
            className="close-button"
          >
            <XIcon width={14} height={14} />
          </button>
        </div>

        {/* Body Content */}
        <div className="modal-body">
          
          {/* 1. Context: Labels */}
          <div className="labels-container">
             {/* Existing Labels */}
             {labels.map(label => (
                <div key={label} className="label-pill">
                  {label}
                  <button onClick={() => removeLabel(label)} className="label-remove-btn">
                    <XIcon width={12} height={12} />
                  </button>
                </div>
              ))}

              {/* Add Label Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="add-label-btn"
                >
                  <PlusIcon width={12} height={12} />
                  <span>Label</span>
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="dropdown-menu">
                    <div className="dropdown-section-header">
                      <span className="dropdown-header-text">Sentiment</span>
                    </div>
                    <div className="dropdown-list">
                      <DropdownItem onClick={() => addLabel('Positive')} label="Positive" />
                      <DropdownItem onClick={() => addLabel('Neutral')} label="Neutral" />
                      <DropdownItem onClick={() => addLabel('Negative')} label="Negative" />
                    </div>

                    <div className="dropdown-section-header top-border">
                      <span className="dropdown-header-text">Tone</span>
                    </div>
                    <div className="dropdown-list">
                      <DropdownItem onClick={() => addLabel('Professional')} label="Professional" />
                      <DropdownItem onClick={() => addLabel('Casual')} label="Casual" />
                      <DropdownItem onClick={() => addLabel('Urgent')} label="Urgent" />
                    </div>
                  </div>
                )}
              </div>
          </div>

          {/* 2. History: Notes List */}
          <div className="notes-list-container">
            {notes.length === 0 ? (
              <div className="empty-state">No notes yet. Start the conversation.</div>
            ) : (
              notes.map(note => (
                <div key={note.id} className="note-item">
                  <div className="note-content">{note.content}</div>
                  <div className="note-meta">{formatTime(note.createdAt)}</div>
                </div>
              ))
            )}
            <div ref={notesEndRef} />
          </div>

          {/* 3. Action: Editor */}
          <div className="editor-container">
            <textarea 
              className="editor-textarea"
              placeholder="Type a note..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {/* Toolbar */}
            <div className="editor-toolbar">
              <div className="toolbar-left">
                <ToolbarButton icon={<BoldIcon />} tooltip="Bold" />
                <ToolbarButton icon={<ItalicIcon />} tooltip="Italic" />
                <div className="toolbar-separator"></div>
                <ToolbarButton icon={<PaletteIcon />} tooltip="Color" />
                <ToolbarButton icon={<ImageIcon />} tooltip="Image" />
              </div>
              <div className="toolbar-right">
                <button 
                  className={`send-note-btn ${!text.trim() ? 'disabled' : ''}`}
                  onClick={handleAddNote}
                  disabled={!text.trim()}
                >
                  Add Note
                  <SendIcon width={12} height={12} />
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="modal-footer">
           <button 
            onClick={onClose}
            className="update-btn"
           >
             Save Changes
           </button>
        </div>

      </div>
    </div>
  );
};

const ToolbarButton: React.FC<{ icon: React.ReactNode; tooltip: string }> = ({ icon, tooltip }) => (
  <button 
    className="toolbar-button"
    title={tooltip}
  >
    {React.cloneElement(icon as React.ReactElement, { width: 9, height: 9 })}
  </button>
);

const DropdownItem: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button 
    onClick={onClick}
    className="dropdown-item"
  >
    {label}
  </button>
);

export default AnnotationModal;