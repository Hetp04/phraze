import React from 'react';

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

const AnalyticsVisual = () => (
  <div className="w-full h-full flex items-center justify-center p-0 relative">
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] bg-gradient-to-br from-teal-50/40 to-indigo-50/40 rounded-full blur-3xl -z-10" />

    <div className="bg-white w-full max-w-[340px] rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] border border-gray-100 p-6 relative z-10">
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

          <div className="bg-[#FAF9F6] rounded-[32px] border border-[#EBE9E4] p-12 h-[400px] flex items-center justify-center relative overflow-hidden">
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

          <div className="bg-white rounded-[32px] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.06)] border border-gray-100 p-12 h-[400px] flex items-center justify-center relative overflow-hidden">
            <AnalyticsVisual />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolsAndAnalyticsSection;
