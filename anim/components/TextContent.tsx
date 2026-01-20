import React from 'react';
import { remap } from '../utils/math';
import { Sparkles, Activity } from 'lucide-react';

interface TextContentProps {
  progress: number;
}

export const TextContent: React.FC<TextContentProps> = ({ progress }) => {
  // Phase 1 & 2: Initial Headline Fades Out
  // Starts dimming at 0.35, fully gone by 0.60
  const headlineOpacity = remap(progress, 0.35, 0.60, 1, 0);
  const headlineScale = remap(progress, 0.35, 0.60, 1, 0.95);
  const headlineBlurT = remap(progress, 0.45, 0.53, 0, 1);
  const headlineBlurEased = headlineBlurT * headlineBlurT * (3 - 2 * headlineBlurT);
  const headlineBlur = 8 * headlineBlurEased;

  // Phase 3: "Meet Phraze" Lockup Appears
  // Starts appearing at 0.58, fully visible by 0.68
  const lockupOpacity = remap(progress, 0.58, 0.68, 0, 1);
  const lockupScale = remap(progress, 0.58, 0.68, 0.94, 1);
  const lockupY = remap(progress, 0.58, 0.68, 20, 0);

  // Phase 4: Subheadline Appears
  // Starts at 0.72, done by 0.85
  const subOpacity = remap(progress, 0.72, 0.85, 0, 1);
  const subY = remap(progress, 0.72, 0.85, 10, 0);

  return (
    <div className="relative z-20 flex flex-col items-center justify-center text-center h-full w-full pointer-events-none">
      
      {/* 1. INITIAL HEADLINE */}
      <div 
        className="absolute flex flex-col items-center justify-center p-4"
        style={{ 
            opacity: headlineOpacity,
            transform: `scale(${headlineScale})`,
            filter: `blur(${headlineBlur}px)`
        }}
      >
        <span className="text-[10px] md:text-xs font-semibold tracking-[0.2em] text-stone-400 mb-6 uppercase opacity-80">
          2015 is over...
        </span>
        
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif-display font-normal text-stone-900 leading-[1.1] mb-6 tracking-tight">
          You Don’t Need <br />
          <span className="italic text-stone-500/80">7+ Tools & Tabs</span>
        </h1>
        
        <p className="text-sm md:text-base text-stone-500 font-light max-w-md mx-auto leading-relaxed">
          Fragmented workflows are costing you hours.
          Stop jumping between PDFs, spreadsheets, and email chains.
        </p>
        <p className="mt-4 text-stone-400 italic font-serif-display text-lg">
          It doesn’t need to be like this.
        </p>
      </div>

      {/* 2. MEET PHRAZE LOCKUP */}
      <div 
        className="absolute flex flex-col items-center justify-center p-4"
        style={{ 
            opacity: lockupOpacity,
            transform: `translateY(${lockupY}px) scale(${lockupScale})`
        }}
      >
        <div className="flex items-center gap-4 md:gap-6 mb-8">
            <span className="text-3xl md:text-5xl font-light text-stone-800 tracking-tight">Meet</span>
            
            <div className="relative group">
                {/* Logo Tile */}
                <div className="w-16 h-16 md:w-20 md:h-20 bg-stone-900 rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                    <Activity className="text-[#FDFBF7] w-8 h-8 md:w-10 md:h-10" strokeWidth={2.5} />
                    <Sparkles className="absolute top-2 right-2 text-yellow-200 w-3 h-3 opacity-80 animate-pulse" />
                </div>
            </div>

            <span className="text-3xl md:text-5xl font-semibold text-stone-900 tracking-tight">Phraze</span>
        </div>

        {/* 3. SUBHEADLINE (Nested to ensure it stays relative to lockup) */}
        <div 
            className="flex flex-col items-center"
            style={{
                opacity: subOpacity,
                transform: `translateY(${subY}px)`
            }}
        >
            <h2 className="text-lg md:text-2xl font-light text-stone-600 mb-3 tracking-wide">
                One place for all your annotation work
            </h2>
            <div className="h-px w-12 bg-stone-300 mb-3"></div>
            <p className="text-sm text-stone-400 font-mono tracking-wider uppercase">
                Highlight • Label • Review • Export
            </p>
        </div>
      </div>

    </div>
  );
};