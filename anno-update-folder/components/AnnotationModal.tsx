import React, { useState, useRef, useEffect } from 'react';
import { 
  XIcon, 
  BoldIcon, 
  ItalicIcon, 
  ImageIcon, 
  PaletteIcon, 
  PlusIcon
} from './Icons';

interface AnnotationModalProps {
  onClose: () => void;
  isOpen: boolean;
}

const AnnotationModal: React.FC<AnnotationModalProps> = ({ onClose, isOpen }) => {
  const [text, setText] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const addLabel = (label: string) => {
    if (!labels.includes(label)) {
      setLabels([...labels, label]);
    }
    setIsDropdownOpen(false);
  };

  const removeLabel = (labelToRemove: string) => {
    setLabels(labels.filter(l => l !== labelToRemove));
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
          <h2 className="modal-title">Add annotation</h2>
          <button 
            onClick={onClose}
            className="close-button"
          >
            <XIcon width={14} height={14} />
          </button>
        </div>

        {/* Body Content */}
        <div className="modal-body">

          {/* Text Area */}
          <div className="editor-container">
            <textarea 
              className="editor-textarea"
              placeholder="Add a note..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {/* Toolbar */}
            <div className="editor-toolbar">
              <ToolbarButton icon={<BoldIcon />} tooltip="Bold" />
              <ToolbarButton icon={<ItalicIcon />} tooltip="Italic" />
              <div className="toolbar-separator"></div>
              <ToolbarButton icon={<PaletteIcon />} tooltip="Color" />
              <ToolbarButton icon={<ImageIcon />} tooltip="Image" />
            </div>
          </div>

          {/* Labels Row */}
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

        </div>

        {/* Footer */}
        <div className="modal-footer">
           <button 
            onClick={onClose}
            className="update-btn"
           >
             Update Annotation
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