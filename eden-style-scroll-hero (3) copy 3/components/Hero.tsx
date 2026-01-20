import React, { useRef } from 'react';
import { useScrollProgress } from '../hooks/useScrollProgress';
import { IconConstellation } from './IconConstellation';
import { TextContent } from './TextContent';
import { FilmGrain } from './FilmGrain';

export const Hero: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // INCREASED to 400vh: This creates a much taller "track" for the scroll.
  // The sticky element inside will remain "locked" in place for 4 screen heights
  // while the animation plays out, before finally scrolling away.
  const SCROLL_HEIGHT_VH = 400; 
  
  const progress = useScrollProgress(containerRef, SCROLL_HEIGHT_VH);

  return (
    <div 
        ref={containerRef} 
        className="relative w-full bg-[#FDFBF7]"
        style={{ height: `${SCROLL_HEIGHT_VH}vh` }}
    >
      {/* 
         sticky top-0 h-screen: This is what locks the content.
         It will stay pinned to the top of the viewport until the bottom of the 
         parent container (400vh down) reaches the bottom of this element.
      */}
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center perspective-1000 z-10">
        
        {/* Cinematic Background Layers (Cream Theme) */}
        
        {/* 1. Base Gradient (Subtle Warm White) */}
        <div className="absolute inset-0 bg-gradient-to-b from-white via-[#FDFBF7] to-[#F5F5F0]" />
        
        {/* 2. Center Glow (Very subtle warmth) */}
        <div 
            className="absolute inset-0 opacity-60"
            style={{
                background: 'radial-gradient(circle at center, #FFFFFF 0%, transparent 70%)',
                opacity: Math.max(0.4, 0.8 - progress * 0.3)
            }}
        />

        {/* 3. Vignette (Soft warm grey edges instead of black) */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(120,113,108,0.05)_100%)]" />

        {/* 4. Film Grain Overlay */}
        <FilmGrain />

        {/* Content Layers */}
        <div className="relative w-full max-w-[1400px] mx-auto h-full px-6 md:px-12">
            <IconConstellation progress={progress} />
            <TextContent progress={progress} />
        </div>

        {/* Debug / Scroll Prompt */}
        <div 
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none transition-opacity duration-500"
            style={{ opacity: progress > 0.05 ? 0 : 0.6 }}
        >
            <span className="text-[10px] uppercase tracking-widest text-stone-400 font-medium">Scroll to explore</span>
            <div className="w-px h-8 bg-gradient-to-b from-stone-300 to-transparent"></div>
        </div>

      </div>
    </div>
  );
};