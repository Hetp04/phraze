import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Highlighter, MessageSquare, Tag, Users } from 'lucide-react';

const IconChevronDown = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const IconBarChart3 = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
);

const IconWrench = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14.7 6.3a5 5 0 0 0-6.4 6.4l-6.1 6.1a2 2 0 0 0 2.8 2.8l6.1-6.1a5 5 0 0 0 6.4-6.4l-2 2-3-3 2-2Z" />
  </svg>
);

const IconTag = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m17.524 17.524l-2.722 2.723a2.567 2.567 0 0 1-3.634 0L4.13 13.209A3.852 3.852 0 0 1 3 10.487V5.568A2.568 2.568 0 0 1 5.568 3h4.919c1.021 0 2 .407 2.722 1.13l7.038 7.038a2.567 2.567 0 0 1 0 3.634z" />
    <path d="M9.126 11.694a2.568 2.568 0 1 0 0-5.137a2.568 2.568 0 0 0 0 5.137" />
  </svg>
);

const IconFileText = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
    <path d="M10 9H8" />
  </svg>
);

const IconUsers = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <path d="M9 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8Z" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconSearch = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m21 21-4.3-4.3" />
    <circle cx="11" cy="11" r="7" />
  </svg>
);

const ToolItem = ({ icon: Icon, label, subLabel }) => (
  <div className="flex flex-col items-center text-center group cursor-pointer">
    <div className="w-[68px] h-[68px] bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)] flex items-center justify-center mb-3 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:border-gray-200">
      <Icon className="w-7 h-7 text-slate-800 stroke-[1.5]" />
    </div>
    <h3 className="font-bold text-slate-900 text-[13px] mb-0.5">{label}</h3>
    <p className="text-[11px] text-slate-400 font-medium">{subLabel}</p>
  </div>
);

export const CollaboratorAvatars = () => {
  return (
    <div className="flex -space-x-2 overflow-hidden items-center justify-center p-1 bg-white rounded-full shadow-sm border border-gray-100">
      <img
        className="inline-block h-6 w-6 rounded-full ring-2 ring-white"
        src="https://picsum.photos/seed/user1/100/100"
        alt="User 1"
      />
      <img
        className="inline-block h-6 w-6 rounded-full ring-2 ring-white"
        src="https://picsum.photos/seed/user2/100/100"
        alt="User 2"
      />
      <img
        className="inline-block h-6 w-6 rounded-full ring-2 ring-white"
        src="https://picsum.photos/seed/user3/100/100"
        alt="User 3"
      />
      <div className="h-6 w-6 rounded-full ring-2 ring-white bg-gray-100 flex items-center justify-center text-[10px] text-gray-500 font-medium">
        +2
      </div>
    </div>
  );
};

export const LiveCollaborationCard = () => {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 3);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const users = [
    { id: 'P', label: 'highlight', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', dot: 'bg-indigo-500', icon: Highlighter, avatarSrc: '/priya.png', position: { x: 18, y: 46 }, linePosition: { x: 18, y: 46 }, nodeOffset: { x: -10, y: -14 } },
    { id: 'A', label: 'label', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500', icon: Tag, avatarSrc: '/alex.png', position: { x: 82, y: 46 }, linePosition: { x: 82, y: 46 }, nodeOffset: { x: 0, y: -14 } },
    { id: 'M', label: 'comment', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', icon: MessageSquare, avatarSrc: '/maya.png', position: { x: 50, y: 82 }, linePosition: { x: 50, y: 82 }, nodeOffset: { x: -16, y: 0 } },
  ];

  const centerPos = { x: 50, y: 40 };

  return (
    <div className="w-full h-full bg-white rounded-3xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden transition-all hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)]">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gray-50 rounded-lg border border-gray-100">
              <Users className="w-3.5 h-3.5 text-gray-700" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm tracking-tight">Collaboration</h3>
          </div>
        </div>

        <div className="flex items-center px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100 shadow-sm">
          <div className="flex gap-2">
            {users.map((u, i) => (
              <div
                key={u.id}
                className={`w-5 h-5 rounded-full border-2 border-white overflow-hidden flex items-center justify-center ${u.bg} transition-all duration-500 ${activeStep === i ? 'opacity-100 scale-110 shadow-sm' : 'opacity-40 scale-100'}`}
              >
                <img src={u.avatarSrc} alt={u.id} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 relative mx-4 mb-6 bg-transparent rounded-2xl min-h-[160px]">
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-0">
          {users.map((user) => (
            <line
              key={user.id}
              x1={`${(user.linePosition ?? user.position).x}%`}
              y1={`${(user.linePosition ?? user.position).y}%`}
              x2={`${centerPos.x}%`}
              y2={`${centerPos.y}%`}
              stroke="#cbd5e1"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="4 6"
            />
          ))}
        </svg>

        {users.map((user, index) => {
          const isActive = activeStep === index;
          const particlePos = user.linePosition ?? user.position;
          return (
            isActive && (
              <motion.div
                key={`particle-${index}`}
                className={`absolute w-2 h-2 rounded-full ${user.dot} z-10 shadow-sm`}
                initial={{ left: `${particlePos.x}%`, top: `${particlePos.y}%`, opacity: 0 }}
                animate={{
                  left: [`${particlePos.x}%`, `${centerPos.x}%`],
                  top: [`${particlePos.y}%`, `${centerPos.y}%`],
                  opacity: [0, 1, 1, 0],
                }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.2 }}
                style={{ transform: 'translate(-50%, -50%)' }}
              />
            )
          );
        })}

        <div
          className="absolute z-20"
          style={{ left: `${centerPos.x}%`, top: `${centerPos.y}%`, transform: 'translate(-50%, -50%)' }}
        >
          <motion.div
            animate={activeStep !== null ? { scale: [1, 1.05, 1], boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' } : {}}
            transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 2.1 }}
            className="w-24 h-20 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col p-2.5 relative z-20"
          >
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="flex items-center gap-1.5 self-start">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                <div className="w-12 h-1.5 bg-gray-100 rounded-full" />
              </div>

              <div className="flex items-center gap-1.5 self-end flex-row-reverse">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 flex-shrink-0" />
                <div className="w-10 h-1.5 bg-indigo-50 rounded-full" />
              </div>

              <div className="flex items-center gap-1.5 self-start">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                <div className="w-8 h-1.5 bg-gray-100 rounded-full" />
              </div>
            </div>

            <div className="mt-auto w-full h-3 bg-gray-50 border border-gray-100 rounded-md flex items-center px-1">
              <div className="w-8 h-1 bg-gray-200 rounded-full opacity-50" />
            </div>

            <div className="absolute -top-3 -right-3">
              <CollaboratorAvatars />
            </div>
          </motion.div>
        </div>

        {users.map((user, index) => {
          const isActive = activeStep === index;
          const Icon = user.icon;
          const nodeOffset = user.nodeOffset ?? { x: 0, y: 0 };

          return (
            <div
              key={user.id}
              className="absolute z-30"
              style={{
                left: `${user.position.x}%`,
                top: `${user.position.y}%`,
                transform: `translate(${nodeOffset.x}px, ${nodeOffset.y}px)`,
              }}
            >
              <motion.div
                className={`w-8 h-8 rounded-full border-2 bg-white flex items-center justify-center text-[10px] font-bold shadow-sm transition-colors duration-300 ${
                  isActive ? `${user.border} ${user.color}` : 'border-gray-100 text-gray-300'
                }`}
                style={{ transform: 'translate(-50%, -50%)' }}
                animate={{ scale: isActive ? 1.15 : 1 }}
              >
                <img
                  src={user.avatarSrc}
                  alt={user.id}
                  className={`w-full h-full rounded-full object-cover ${isActive ? '' : 'opacity-50 grayscale'}`}
                />
              </motion.div>

              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                    className={`absolute top-5 left-1/2 px-2.5 py-1 bg-white rounded-md shadow-lg border text-[9px] font-bold uppercase tracking-wide flex items-center gap-1 whitespace-nowrap z-40 ${user.color} ${user.border}`}
                    style={{ transform: 'translateX(-50%)' }}
                  >
                    <Icon className="w-2.5 h-2.5" />
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

const AnalyticsVisual = () => (
  <div className="w-full h-full flex items-center justify-center p-0 relative">
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] bg-gradient-to-br from-teal-50/40 to-indigo-50/40 rounded-full blur-3xl -z-10" />

    <div className="bg-white w-full max-w-[340px] rounded-2xl border border-gray-100 p-6 relative z-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-slate-700">
            <IconBarChart3 className="w-4 h-4" />
          </div>
          <span className="font-semibold text-slate-700 text-sm">Annotation Statistics</span>
        </div>
      </div>

      <div className="relative h-32 w-full mb-6">
        <svg viewBox="0 0 300 100" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="chartGradientHome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#64748b" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#64748b" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path d="M0,80 C40,80 60,30 100,30 S180,60 220,50 S260,20 300,20 L300,100 L0,100 Z" fill="url(#chartGradientHome)" />
          <path d="M0,80 C40,80 60,30 100,30 S180,60 220,50 S260,20 300,20" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
        </svg>

        <div className="flex justify-between mt-2 text-[10px] text-gray-400 font-medium px-1">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
          <span>Sun</span>
        </div>
      </div>

      <div className="border-t border-gray-50 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-slate-600">Positive Feedback</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 font-medium">Quantity</span>
            <span className="text-xs font-semibold text-slate-800">342</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs font-medium text-slate-600">Sentiment Analysis</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 font-medium">Quantity</span>
            <span className="text-xs font-semibold text-slate-800">856</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-xs font-medium text-slate-600">User Questions</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 font-medium">Quantity</span>
            <span className="text-xs font-semibold text-slate-800">194</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ToolsAndAnalyticsSection = () => {
  return (
    <div className="w-full max-w-[1200px] mx-auto py-[72px] px-[24px]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="flex flex-col">
          <h2 className="text-3xl font-serif font-bold text-slate-900 mb-4">Annotate your chats</h2>
          <p className="text-slate-500 text-lg leading-relaxed font-light mb-8 max-w-md md:min-h-[84px]">
            Highlight, code, and take notes directly in conversations so insights are always captured, organized, and never lost.
          </p>

          <div className="bg-[#FAF9F6] rounded-[32px] border border-[#EBE9E4] p-12 h-[400px] flex items-center justify-center relative overflow-hidden select-none">
            <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-8 w-full max-w-md">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-slate-700">
                  <IconWrench className="w-4 h-4" />
                </div>
                <span className="font-semibold text-slate-700 text-sm">Tools</span>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <ToolItem icon={IconTag} label="Labels" subLabel="Active" />
                <ToolItem icon={IconFileText} label="Notes" subLabel="Synced" />
                <ToolItem icon={IconUsers} label="Collaboration" subLabel="Is live" />
                <ToolItem icon={IconSearch} label="Search" subLabel="Annotations" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <h2 className="text-3xl font-serif font-bold text-slate-900 mb-4">Analyze your data</h2>
          <p className="text-slate-500 text-lg leading-relaxed font-light mb-8 max-w-md md:min-h-[84px]">
            Visualize trends and uncover hidden patterns in your conversations with powerful analytics tools.
          </p>

          <div className="bg-[#FAF9F6] rounded-[32px] border border-[#EBE9E4] p-12 h-[400px] flex items-center justify-center relative overflow-hidden select-none">
            <AnalyticsVisual />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mt-10">
        <div className="bg-[#FAF9F6] rounded-[32px] border border-[#EBE9E4] p-8 h-[400px] md:col-span-2 flex flex-col">
          <div className="mb-4">
            <h3 className="text-lg font-serif font-bold text-slate-900">Live collaboration</h3>
            <p className="text-slate-500 text-sm font-light mt-1">See changes merge in real time as your team annotates.</p>
          </div>
          <div className="flex-1 w-full">
            <LiveCollaborationCard />
          </div>
        </div>
        <div className="bg-[#FAF9F6] rounded-[32px] border border-[#EBE9E4] p-8 h-[400px] md:col-span-1" />
      </div>
    </div>
  );
};

export default ToolsAndAnalyticsSection;
