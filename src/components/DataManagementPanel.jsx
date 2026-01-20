import React from 'react';

export default function DataManagementPanel() {
  return (
    <div style={{ 
      width: '100%',
      background: 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '600px',
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        padding: '16px',
        margin: '0 auto',
        pointerEvents: 'auto'
      }}>
        {/* Header */}
        <h2 style={{
          margin: 0,
          marginBottom: '8px',
          fontSize: '16px',
          fontWeight: 600,
          color: '#18181b',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          letterSpacing: '-0.01em'
        }}>
          Data Management
        </h2>
        
        <p style={{
          margin: 0,
          marginBottom: '20px',
          fontSize: '13px',
          color: '#71717a',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          lineHeight: '1.5'
        }}>
          Export your annotations to a file for backup or sharing, or import previously exported annotation data.
        </p>

        {/* Action Buttons */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '24px'
        }}>
          <div style={{
            padding: '12px 16px',
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span style={{
              fontSize: '14px',
              fontWeight: 500,
              color: '#52525b',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              letterSpacing: '-0.01em'
            }}>
              Export Data
            </span>
          </div>

          <div style={{
            padding: '12px 16px',
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span style={{
              fontSize: '14px',
              fontWeight: 500,
              color: '#52525b',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              letterSpacing: '-0.01em'
            }}>
              Import Data
            </span>
          </div>
        </div>

        {/* Share Section */}
        <p style={{
          margin: 0,
          marginBottom: '12px',
          fontSize: '13px',
          color: '#71717a',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          lineHeight: '1.5'
        }}>
          Share your annotations with others using a unique link.
        </p>

        <div style={{
          padding: '12px 16px',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span style={{
            fontSize: '14px',
            fontWeight: 500,
            color: '#52525b',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            letterSpacing: '-0.01em'
          }}>
            Share and View
          </span>
        </div>
      </div>
    </div>
  );
}


