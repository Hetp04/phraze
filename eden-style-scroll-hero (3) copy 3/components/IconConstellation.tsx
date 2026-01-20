import React from 'react';
import { 
  FileText, 
  Mail, 
  MessageSquare, 
  Table2, 
  Tag, 
  Highlighter, 
  Users, 
  Share2,
  FileBox
} from 'lucide-react';
import { remap } from '../utils/math';

interface IconConstellationProps {
  progress: number; // 0 to 1
}

// Configuration for each icon's behavior
// pos: [top%, left%] starting position
// vector: [x, y] direction vector for dispersal (normalized-ish)
// color: background color tailwind class or hex
// Icon: The icon component
const ICONS_CONFIG = [
  // Top-left quadrant: Reviewing/PDF
  { 
    id: 1, 
    pos: { top: '25%', left: '25%' }, 
    vector: { x: -120, y: -80 }, 
    color: 'bg-white text-stone-800', 
    Icon: FileText,
    label: 'Research'
  },
  // Upper-center/right: ChatGPT-style
  { 
    id: 2, 
    pos: { top: '18%', left: '55%' }, 
    vector: { x: 80, y: -100 }, 
    color: 'bg-emerald-600 text-white', 
    Icon: MessageSquare,
    label: 'AI Chat'
  },
  // Right side: Stacked 1 (Orange)
  { 
    id: 3, 
    pos: { top: '35%', left: '75%' }, 
    vector: { x: 150, y: -20 }, 
    color: 'bg-orange-500 text-white', 
    Icon: Share2,
    label: 'Export'
  },
  // Right side: Stacked 2 (Dropbox-like)
  { 
    id: 4, 
    pos: { top: '48%', left: '72%' }, 
    vector: { x: 140, y: 40 }, 
    color: 'bg-blue-600 text-white', 
    Icon: FileBox,
    label: 'Storage'
  },
  // Left side: Drive-like
  { 
    id: 5, 
    pos: { top: '45%', left: '15%' }, 
    vector: { x: -160, y: 0 }, 
    color: 'bg-green-500 text-white', 
    Icon: Table2,
    label: 'Datasets'
  },
  // Lower-left: Notion-like
  { 
    id: 6, 
    pos: { top: '65%', left: '22%' }, 
    vector: { x: -100, y: 120 }, 
    color: 'bg-white text-stone-800 border-stone-100', 
    Icon: Tag,
    label: 'Tags'
  },
  // Lower-left: Yellow tool
  { 
    id: 7, 
    pos: { top: '72%', left: '35%' }, 
    vector: { x: -40, y: 150 }, 
    color: 'bg-yellow-400 text-yellow-900', 
    Icon: Highlighter,
    label: 'Highlight'
  },
  // Lower-right: Evernote-like
  { 
    id: 8, 
    pos: { top: '68%', left: '65%' }, 
    vector: { x: 100, y: 130 }, 
    color: 'bg-emerald-800 text-white', 
    Icon: Users,
    label: 'Team'
  },
];

export const IconConstellation: React.FC<IconConstellationProps> = ({ progress }) => {
  // Phase 1 (0 -> 0.25): Pressure builds (small movement out)
  // Phase 2 (0.25 -> 0.55): Icons escape (large movement out, fade, scale down)
  // Phase 3 (0.55 -> 0.72): Finish disappearance

  // Calculate global transition values
  const dispersal = remap(progress, 0, 0.55, 0, 1); // 0 to 1 movement factor
  const opacity = remap(progress, 0.4, 0.65, 1, 0); // Start fading later, gone by 0.65
  const scale = remap(progress, 0.25, 0.65, 1, 0.8); // Slight shrink
  const blur = remap(progress, 0.45, 0.65, 0, 4); // Blur out

  return (
    <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
      {ICONS_CONFIG.map((icon, index) => {
        // Individual randomizers for organic feel
        const randomDelay = index * 0.1;
        const driftDuration = 4 + (index % 3); 
        
        // Calculate dynamic transform
        const xMove = icon.vector.x * dispersal * 2; // Multiplier defines max travel distance in px
        const yMove = icon.vector.y * dispersal * 2;
        
        // Rotation logic:
        // Start rotation slightly after movement begins (0.05) to simulate drag/inertia
        // Varies per icon (clockwise/counter-clockwise and magnitude)
        // Increases as they move further out
        const rotationDirection = index % 2 === 0 ? 1 : -1;
        const rotationMax = 15 + (index % 3) * 5; // Varies between 15 and 25 degrees
        const rotation = remap(progress, 0.05, 0.6, 0, rotationDirection * rotationMax);

        // Use standard inline styles for high-performance transforms
        const style: React.CSSProperties = {
          top: icon.pos.top,
          left: icon.pos.left,
          opacity: opacity,
          filter: `blur(${blur}px)`,
          transform: `translate(${xMove}px, ${yMove}px) rotate(${rotation}deg) scale(${scale})`,
          transition: 'none', // Critical: we are driving via scroll, disable CSS transition lag
        };

        return (
          <div
            key={icon.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={style}
          >
            {/* Inner container for idle animation */}
            <div 
                className="relative group animate-float"
                style={{ animationDuration: `${driftDuration}s`, animationDelay: `${randomDelay}s` }}
            >
              <div 
                className={`
                    w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center 
                    transition-shadow duration-500
                    ${icon.color}
                    ring-1 ring-black/5
                `}
                style={{
                    boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.12), 0 2px 8px -2px rgba(0,0,0,0.05)'
                }}
              >
                <icon.Icon size={28} strokeWidth={1.5} />
              </div>
            </div>
          </div>
        );
      })}
      
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(0, -6px); }
        }
        .animate-float {
          animation: float ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};