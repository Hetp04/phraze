import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Highlighter, Tag, MessageSquare } from 'lucide-react';

export const LiveCollaborationCard = () => {
  const [activeStep, setActiveStep] = useState(0);

  // Cycle through the 3 users continuously
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 3);
    }, 2500); // Switch every 2.5 seconds
    return () => clearInterval(interval);
  }, []);

  // Configuration for the 3 orbiting users in a T-shape layout for perfect symmetry
  const users = [
    { id: 'P', label: 'highlight', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', dot: 'bg-indigo-500', icon: Highlighter, position: { x: 18, y: 50 } }, // Left
    { id: 'A', label: 'label', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500', icon: Tag, position: { x: 82, y: 50 } }, // Right
    { id: 'M', label: 'comment', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', icon: MessageSquare, position: { x: 50, y: 82 } }, // Bottom
  ];

  const centerPos = { x: 50, y: 50 };

  return (
    <div className="w-full h-full bg-white rounded-3xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden transition-all hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)]">
      
      {/* 1. Header Area */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div>
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gray-50 rounded-lg border border-gray-100">
                    <Users className="w-3.5 h-3.5 text-gray-700" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm tracking-tight">Collaboration</h3>
            </div>
        </div>
        
        {/* Sync Status Badge */}
        <div className="flex items-center px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100 shadow-sm">
            <div className="flex gap-2">
                {users.map((u, i) => (
                    <div 
                        key={u.id} 
                        className={`w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold ${u.bg} ${u.color} transition-all duration-500 ${activeStep === i ? 'opacity-100 scale-110 shadow-sm' : 'opacity-40 scale-100'}`}
                    >
                        {u.id}
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* 2. Visual Stage */}
      <div className="flex-1 relative mx-4 mb-6 bg-gray-50/40 rounded-2xl border border-gray-100/50 min-h-[160px]">
        
        {/* SVG Layer for Static Connection Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-0">
            {users.map((user, index) => (
                <line 
                    key={index}
                    x1={`${user.position.x}%`} 
                    y1={`${user.position.y}%`} 
                    x2={`${centerPos.x}%`} 
                    y2={`${centerPos.y}%`} 
                    stroke="#cbd5e1" 
                    strokeWidth="1.5" 
                    strokeLinecap="round"
                    strokeDasharray="4 6"
                />
            ))}
        </svg>

        {/* Dynamic Particles */}
        {users.map((user, index) => {
            const isActive = activeStep === index;
            return isActive && (
                <motion.div
                    key={`particle-${index}`}
                    className={`absolute w-2 h-2 rounded-full ${user.dot} z-10 shadow-sm`}
                    initial={{ left: `${user.position.x}%`, top: `${user.position.y}%`, opacity: 0 }}
                    animate={{ 
                        left: [`${user.position.x}%`, `${centerPos.x}%`], 
                        top: [`${user.position.y}%`, `${centerPos.y}%`],
                        opacity: [0, 1, 1, 0]
                    }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.2 }}
                    style={{ 
                        transform: 'translate(-50%, -50%)', 
                    }} 
                />
            );
        })}

        {/* --- Nodes --- */}

        {/* Center Hub Node - Chat UI Representation */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
             <motion.div 
                animate={activeStep !== null ? { scale: [1, 1.05, 1], boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" } : {}}
                transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 2.1 }}
                className="w-24 h-20 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col p-2.5 relative z-20"
             >
                {/* Chat Messages Container */}
                <div className="flex flex-col gap-1.5 flex-1">
                    {/* Incoming Message */}
                    <div className="flex items-center gap-1.5 self-start">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                        <div className="w-12 h-1.5 bg-gray-100 rounded-full" />
                    </div>

                    {/* Outgoing Message */}
                    <div className="flex items-center gap-1.5 self-end flex-row-reverse">
                         <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 flex-shrink-0" />
                         <div className="w-10 h-1.5 bg-indigo-50 rounded-full" />
                    </div>

                    {/* Incoming Message Short */}
                    <div className="flex items-center gap-1.5 self-start">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                        <div className="w-8 h-1.5 bg-gray-100 rounded-full" />
                    </div>
                </div>

                {/* Input Area */}
                <div className="mt-auto w-full h-3 bg-gray-50 border border-gray-100 rounded-md flex items-center px-1">
                     <div className="w-8 h-1 bg-gray-200 rounded-full opacity-50" />
                </div>
             </motion.div>
        </div>

        {/* User Nodes */}
        {users.map((user, index) => {
            const isActive = activeStep === index;
            return (
                <div
                    key={user.id}
                    className="absolute z-30"
                    style={{ left: `${user.position.x}%`, top: `${user.position.y}%` }}
                >
                    <motion.div
                        className={`w-8 h-8 rounded-full border-2 bg-white flex items-center justify-center text-[10px] font-bold shadow-sm transition-colors duration-300 ${isActive ? user.border + ' ' + user.color : 'border-gray-100 text-gray-300'}`}
                        style={{ transform: 'translate(-50%, -50%)' }}
                        animate={{ scale: isActive ? 1.15 : 1 }}
                    >
                        {user.id}
                    </motion.div>
                    
                    {/* Floating Label Popup */}
                     <AnimatePresence>
                        {isActive && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.9, x: '-50%' }}
                                animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
                                exit={{ opacity: 0, scale: 0.9, x: '-50%', transition: { duration: 0.2 } }}
                                className={`absolute top-5 left-1/2 px-2.5 py-1 bg-white rounded-md shadow-lg border text-[9px] font-bold uppercase tracking-wide flex items-center gap-1 whitespace-nowrap z-40 ${user.color} ${user.border}`}
                            >
                                <user.icon className="w-2.5 h-2.5" />
                                {user.label}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            );
        })}

      </div>
    </div>
  );
};