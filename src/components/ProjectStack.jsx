import React, { useEffect, useState } from 'react';

export default function ProjectStack() {
  const [visibleCards, setVisibleCards] = useState([]);

  const items = [
    { label: 'Project Alpha', type: 'project', threads: 12, annotations: 5 },
    { label: 'Project Beta', type: 'project', threads: 8, annotations: 3 },
    { label: 'Project Gamma', type: 'project', threads: 15, annotations: 7 },
    { label: 'Create New Project', type: 'create' }
  ];

  const baseOffsets = [0, 78, 156, 234];

  useEffect(() => {
    // Animate cards one by one with delays
    items.forEach((_, index) => {
      setTimeout(() => {
        setVisibleCards(prev => [...prev, index]);
      }, index * 200); // 200ms delay between each card
    });
  }, []);

  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 10px 28px', background: 'transparent' }}>
      <div style={{ position: 'relative', width: '100%', height: '290px' }}>
        {items.map((item, index) => {
          const isCreate = item.type === 'create';
          const zIndex = 40 - index * 10;
          const isVisible = visibleCards.includes(index);

          return (
            <div
              key={item.label}
              style={{
                position: 'absolute',
                left: '50%',
                top: `${baseOffsets[index]}px`,
                transform: isVisible ? 'translateX(-50%) translateY(0px)' : 'translateX(-50%) translateY(20px)',
                width: '100%',
                zIndex,
                background: '#ffffff',
                border: isCreate ? '1.5px dashed #d1d5db' : '1px solid #e5e7eb',
                borderRadius: '6px 6px 0 0',
                boxShadow: index === 0 
                  ? '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)' 
                  : index === 1
                  ? '0 3px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.03)'
                  : index === 2
                  ? '0 2px 6px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)'
                  : '0 1px 3px rgba(0,0,0,0.03)',
                overflow: 'hidden',
                opacity: isVisible ? (index === 0 ? 1 : index === 1 ? 0.92 : index === 2 ? 0.78 : 0.64) : 0,
                transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: '4px', 
                    background: isCreate ? '#fafafa' : '#f4f4f5',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: '1px solid #e5e7eb'
                  }}>
                    {isCreate ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingTop: '1px' }}>
                    <h3 style={{ 
                      margin: 0, 
                      fontSize: '14px', 
                      fontWeight: 600, 
                      color: isCreate ? '#71717a' : '#18181b',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      letterSpacing: '-0.01em',
                      lineHeight: '1.4'
                    }}>
                      {item.label}
                    </h3>
                    {!isCreate && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ 
                          fontSize: '10px', 
                          color: '#52525b',
                          fontWeight: 500,
                          letterSpacing: '-0.01em',
                          background: '#f4f4f5',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          border: '1px solid #e4e4e7'
                        }}>
                          {item.threads} threads
                        </span>
                        <span style={{ 
                          fontSize: '10px', 
                          color: '#52525b',
                          fontWeight: 500,
                          letterSpacing: '-0.01em',
                          background: '#f4f4f5',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          border: '1px solid #e4e4e7'
                        }}>
                          {item.annotations} annotations
                        </span>
                      </div>
                    )}
                    {isCreate && (
                      <p style={{ 
                        margin: 0, 
                        marginTop: '6px', 
                        fontSize: '13px', 
                        color: '#a1a1aa',
                        letterSpacing: '-0.01em',
                        lineHeight: '1.4'
                      }}>
                        Start a new workspace
                      </p>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4d4d8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}