import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { 
  User, 
  Share2, 
  MessageSquareText, 
  Highlighter, 
  Tag, 
  MessageCircle, 
  CheckCircle,
} from 'lucide-react';
import { NodePosition, Connection } from '../types';
import { CollaboratorAvatars } from './CollaboratorAvatars';

const CONTAINER_HEIGHT = 320;
const CONTAINER_WIDTH = 1200;

const nodes: NodePosition[] = [
  // 1. Single User Start
  { id: 'start', x: 8, y: 50, label: 'Annotate', subLabel: 'Private', type: 'start', labelPosition: 'bottom' },
  
  // 2. Transition
  { id: 'share', x: 22, y: 50, label: 'Share', subLabel: 'Invite Team', type: 'transition', labelPosition: 'bottom' },
  
  // 3. Central Hub (The "Team" state)
  { id: 'hub', x: 38, y: 50, label: 'Shared Thread', subLabel: 'Team Workspace', type: 'hub', labelPosition: 'bottom' },
  
  // 4. Parallel Work Streams (The "Collaboration" actions)
  { id: 'co-annotate', x: 65, y: 20, label: 'Co-Annotate', type: 'branch', labelPosition: 'top' },
  { id: 'labels', x: 65, y: 50, label: 'Shared Labels', type: 'branch', labelPosition: 'bottom' },
  { id: 'discuss', x: 65, y: 80, label: 'Discuss', type: 'branch', labelPosition: 'bottom' },
  
  // 5. Result
  { id: 'end', x: 92, y: 50, label: 'Insights', subLabel: 'Export Ready', type: 'end', labelPosition: 'bottom' },
];

const connections: Connection[] = [
  // Linear Start
  { from: 'start', to: 'share' },
  { from: 'share', to: 'hub' },

  // Fan Out
  { from: 'hub', to: 'co-annotate' },
  { from: 'hub', to: 'labels' },
  { from: 'hub', to: 'discuss' },

  // Fan In
  { from: 'co-annotate', to: 'end' },
  { from: 'labels', to: 'end' },
  { from: 'discuss', to: 'end' },
];

export const PhrazeWorkflow: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-50px" });

  const getCoords = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    return {
      x: (node.x / 100) * CONTAINER_WIDTH,
      y: (node.y / 100) * CONTAINER_HEIGHT
    };
  };

  // Improved curve logic for Fan-Out/Fan-In
  const getPath = (startId: string, endId: string) => {
    const start = getCoords(startId);
    const end = getCoords(endId);
    
    // Straight line for horizontal connections
    if (Math.abs(start.y - end.y) < 5) {
        return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    }

    // Bezier curve for branching
    // We adjust the control points to make the lines leave/arrive horizontally
    const controlPointOffset = (end.x - start.x) * 0.5;
    
    return `M ${start.x} ${start.y} 
            C ${start.x + controlPointOffset} ${start.y}, 
              ${end.x - controlPointOffset} ${end.y}, 
              ${end.x} ${end.y}`;
  };

  const getNodeIcon = (id: string, type: string) => {
    const isBranch = type === 'branch';
    const className = isBranch ? "w-5 h-5 text-gray-600" : "w-6 h-6 text-gray-700";
    
    switch(id) {
        case 'start': return <User className={className} />;
        case 'share': return <Share2 className={className} />;
        case 'hub': return <MessageSquareText className="w-8 h-8 text-blue-600" />;
        case 'co-annotate': return <Highlighter className={className} />;
        case 'labels': return <Tag className={className} />;
        case 'discuss': return <MessageCircle className={className} />;
        case 'end': return <CheckCircle className={className} />;
        default: return <User className={className} />;
    }
  };

  return (
    <div className="w-full overflow-x-auto workflow-scroll bg-gradient-to-b from-gray-50 to-white rounded-xl border border-gray-100 shadow-sm">
      <div 
        ref={containerRef}
        className="relative mx-auto my-12" 
        style={{ width: CONTAINER_WIDTH, height: CONTAINER_HEIGHT }}
      >
        <svg 
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ zIndex: 0 }}
        >
            <defs>
              <linearGradient id="line-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#cbd5e1" />
                <stop offset="100%" stopColor="#94a3b8" />
              </linearGradient>
            </defs>
            {connections.map((conn, i) => {
                const pathD = getPath(conn.from, conn.to);
                return (
                    <g key={`${conn.from}-${conn.to}`}>
                        {/* Background line */}
                        <motion.path 
                            d={pathD}
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="4"
                            initial={{ pathLength: 0 }}
                            animate={isInView ? { pathLength: 1 } : {}}
                            transition={{ duration: 0.5, delay: 0 }}
                        />
                        {/* Active Line */}
                        <motion.path 
                            d={pathD}
                            fill="none"
                            stroke="#94a3b8"
                            strokeWidth="2"
                            initial={{ pathLength: 0 }}
                            animate={isInView ? { pathLength: 1 } : {}}
                            transition={{ duration: 1.2, delay: i * 0.1, ease: "easeOut" }}
                        />
                         {/* Flow Particles */}
                         <motion.circle r="3" fill="#3b82f6">
                            <animateMotion 
                                dur={`${2 + Math.random()}s`}
                                begin={`${i * 0.2}s`}
                                repeatCount="indefinite" 
                                path={pathD}
                                keyPoints="0;1"
                                keyTimes="0;1"
                                calcMode="linear"
                            />
                        </motion.circle>
                    </g>
                );
            })}
        </svg>

        {nodes.map((node, index) => {
            const coords = getCoords(node.id);
            const isHub = node.type === 'hub';
            const isBranch = node.type === 'branch';
            
            return (
                <motion.div
                    key={node.id}
                    className="absolute flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2 z-10"
                    style={{ left: coords.x, top: coords.y }}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={isInView ? { scale: 1, opacity: 1 } : {}}
                    transition={{ 
                        type: "spring", 
                        stiffness: 300, 
                        damping: 20, 
                        delay: index * 0.1
                    }}
                >
                    {/* Node Circle */}
                    <div 
                        className={`
                            relative flex items-center justify-center rounded-full shadow-sm border transition-all duration-300 bg-white
                            ${isHub 
                                ? 'w-24 h-24 border-blue-500 ring-4 ring-blue-50 z-20 shadow-xl' 
                                : isBranch
                                    ? 'w-14 h-14 border-gray-200 hover:border-blue-400 hover:scale-110 z-10'
                                    : 'w-16 h-16 border-gray-200 hover:border-blue-400'
                            }
                        `}
                    >
                        {getNodeIcon(node.id, node.type)}
                        
                        {isHub && (
                            <div className="absolute -top-3 -right-3">
                                <CollaboratorAvatars />
                            </div>
                        )}
                    </div>

                    {/* Labels */}
                    <div 
                        className={`
                            absolute text-center w-32
                            ${node.labelPosition === 'top' ? '-top-8 mb-2' : 'top-full mt-3'}
                        `}
                    >
                        <h3 className={`font-semibold ${isHub ? 'text-lg text-blue-900' : isBranch ? 'text-sm text-gray-700' : 'text-base text-gray-900'}`}>
                            {node.label}
                        </h3>
                        {node.subLabel && (
                            <p className="text-[10px] text-gray-400 mt-0.5 font-medium tracking-wide uppercase">
                                {node.subLabel}
                            </p>
                        )}
                    </div>
                </motion.div>
            );
        })}
      </div>
    </div>
  );
};