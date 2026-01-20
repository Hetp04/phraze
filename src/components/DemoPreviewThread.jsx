import React, { useMemo } from 'react';
import { getImagePath } from '../utils/assetPaths';

export const mayaImg = getImagePath('maya.png');
export const alexImg = getImagePath('alex.png');
export const priyaImg = getImagePath('priya.png');

export function DemoPreviewThread({ disableScroll = false, maxMessages, instant = false, swipeToBlankOnHighlightEnd = false, forceFinalSnapshot = false }) {
  const rows = useMemo(() => {
    const baseRows = [
      { role: 'user', name: 'Jin Liner', initials: 'JL', text: 'Hey! I am having trouble with API authentication in my React app.' },
      { role: 'assistant', name: 'phraze', initials: 'P', text: 'I can help with that! What specific API are you trying to integrate?' },
      { role: 'user', name: 'Jin Liner', initials: 'JL', text: 'Weather API — keeps returning 401 errors. Where should I put the API key?' },
      { role: 'assistant', name: 'phraze', initials: 'P', text: 'Create a .env file and add VITE_WEATHER_API_KEY=your_key. Access it with import.meta.env.VITE_WEATHER_API_KEY. Never commit the key — add .env to .gitignore!' },
      { role: 'user', name: 'Alex Kim', initials: 'AK', text: 'Do we need to restart the dev server after changing .env?' },
      { role: 'assistant', name: 'phraze', initials: 'P', text: 'Yes. Env vars are loaded at startup. Stop and rerun npm run dev so Vite picks up the change.' },
    ];

    const limited = typeof maxMessages === 'number'
      ? baseRows.slice(0, Math.max(0, Math.min(baseRows.length, maxMessages)))
      : baseRows;

    if (swipeToBlankOnHighlightEnd || forceFinalSnapshot) {
      return limited;
    }

    return limited;
  }, [forceFinalSnapshot, maxMessages, swipeToBlankOnHighlightEnd]);

  const nameToAvatar = useMemo(() => ({
    'Jin Liner': mayaImg,
    'Alex Kim': alexImg,
    'Paige Lamar': priyaImg,
  }), []);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflowY: disableScroll ? 'hidden' : 'auto',
        padding: '12px 8px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((row, idx) => {
          const avatar = nameToAvatar[row.name];
          const isAssistant = row.role === 'assistant';

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                justifyContent: isAssistant ? 'flex-start' : 'flex-start',
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9999,
                  overflow: 'hidden',
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  flex: '0 0 28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#374151',
                }}
              >
                {avatar ? (
                  <img src={avatar} alt={row.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  row.initials
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{row.name}</div>
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    lineHeight: 1.45,
                    color: isAssistant ? '#111827' : '#111827',
                    opacity: instant ? 1 : 1,
                  }}
                >
                  {row.text}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
