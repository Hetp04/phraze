import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useScroll, useSpring, useMotionValueEvent } from 'framer-motion';
import { 
  MessageSquare,
  Users,
  Table
} from 'lucide-react';
import IconTile from './IconTile';
import { mapRange, smoothStep, clamp } from '../utils/animation';
import { ExpandableScreenTrigger, useExpandableScreen } from '../../src/components/ui/expandable-screen.jsx';
import adobeIconPng from '../../animationIcons/adobe.png';
import slackIconSvg from '../../animationIcons/Slack_icon_2019.svg';
import googleDocsIconPng from '../../animationIcons/docs.png';
import teamsIconSvg from '../../animationIcons/teams.svg';
import nvivoIconPng from '../../animationIcons/nvivo.png';
import hypothesisIconSvg from '../../animationIcons/Hypothesis_Icon.svg';

const fract = (v: number) => v - Math.floor(v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const prand = (seed: number) => fract(Math.sin(seed * 12.9898) * 43758.5453);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const ScrollHero: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const { isExpanded } = useExpandableScreen();
  const isExpandedRef = useRef(isExpanded);

  useEffect(() => {
    isExpandedRef.current = isExpanded;
  }, [isExpanded]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 220, damping: 34, mass: 0.22 });

  useMotionValueEvent(smoothProgress, 'change', (v) => {
    if (isExpandedRef.current) return;
    const deadZone = 0.025;
    const delayed = v <= deadZone ? 0 : (v - deadZone) / (1 - deadZone);
    setProgress(clamp(delayed, 0, 1));
  });

  // --- ANIMATION VALUES ---
  const vignetteIntensity = mapRange(progress, 0.2, 0.8, 22, 62);
  // We inverse the glow: a bright spot that focuses
  const bgGlowScale = mapRange(progress, 0, 0.5, 1, 0.4); 

  const exitProgress = smoothStep(0.03, 0.5, progress);
  const flareBoost = smoothStep(0.7, 1, exitProgress);
  
  const headlineOpacity = 1 - smoothStep(0.24, 0.41, progress);
  const headlineScale = mapRange(smoothStep(0, 0.41, progress), 0, 1, 1, 0.95);
  const headlineBlur = mapRange(smoothStep(0.26, 0.41, progress), 0, 1, 0, 10);

  const iconGlobalOpacity = 1 - smoothStep(0.22, 0.48, progress);
  const iconBlur = mapRange(smoothStep(0.30, 0.48, progress), 0, 1, 0, 4);

  const lockupEnterProgress = smoothStep(0.5, 0.75, progress);
  const lockupOpacity = lockupEnterProgress;
  const lockupScale = mapRange(lockupEnterProgress, 0, 1, 1.1, 1);
  const lockupY = mapRange(lockupEnterProgress, 0, 1, 30, 0);

  const subtextProgress = smoothStep(0.75, 0.9, progress);
  const subtextOpacity = subtextProgress;
  const subtextY = mapRange(subtextProgress, 0, 1, 20, 0);

  const icons = useMemo(() => {
    type IconDef =
      | { type?: 'lucide'; Icon: any; color: string; r: number; scale: number }
      | { type: 'image'; src: string; r: number; scale: number };

    const defs = [
      { type: 'image', src: googleDocsIconPng, r: -12, scale: 0.9 },
      { Icon: MessageSquare, color: 'blue', r: 15, scale: 0.95 },
      { type: 'image', src: slackIconSvg, r: -5, scale: 0.9 },
      { type: 'image', src: nvivoIconPng, r: 5, scale: 0.85 },
      { type: 'image', src: teamsIconSvg, r: -8, scale: 0.9 },
      { type: 'image', src: adobeIconPng, r: 0, scale: 0.85 },
      { type: 'image', src: hypothesisIconSvg, r: 10, scale: 0.95 },
      { Icon: Table, color: 'yellow', r: -15, scale: 1.0 },
    ] satisfies IconDef[];

    const startAngle = -Math.PI / 2;
    const step = (Math.PI * 2) / defs.length;
    const baseRadiusVw = 28;
    const baseRadiusVh = 30;
    const destRadiusVw = 71;
    const destRadiusVh = 79;

    return defs.map((d, i) => {
      const a = startAngle + i * step;
      const x = Math.cos(a) * baseRadiusVw;
      const y = Math.sin(a) * baseRadiusVh;
      const destX = Math.cos(a) * destRadiusVw;
      const destY = Math.sin(a) * destRadiusVh;
      return {
        id: i + 1,
        type: d.type ?? 'lucide',
        Icon: 'Icon' in d ? d.Icon : undefined,
        color: 'color' in d ? d.color : undefined,
        src: 'src' in d ? d.src : undefined,
        x,
        y,
        destX,
        destY,
        r: d.r,
        scale: d.scale,
      };
    });
  }, []);

  return (
    <div ref={containerRef} className="relative h-[420vh] w-full bg-[#FFFDF8] text-stone-900">
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-24 bg-gradient-to-b from-[#FFFDF8] to-transparent z-20" />
      <div
        className="pointer-events-none absolute left-0 right-0 -bottom-px h-32 z-20"
        style={{
          backgroundImage: [
            'linear-gradient(to top, rgba(255,253,248,1) 0%, rgba(255,253,248,1) 30%, rgba(255,253,248,0) 100%)',
            'radial-gradient(120% 110% at 0% 100%, rgba(255,253,248,1) 0%, rgba(255,253,248,1) 22%, rgba(255,253,248,0) 62%)',
            'radial-gradient(120% 110% at 100% 100%, rgba(255,253,248,1) 0%, rgba(255,253,248,1) 22%, rgba(255,253,248,0) 62%)'
          ].join(', ')
        }}
      />
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center">
        <div className="absolute inset-x-0 top-0 bottom-12 bg-[#FFFDF8]" />
        
        {/* --- LIGHT BACKGROUND ATMOSPHERE --- */}
        <div className="absolute inset-0 pointer-events-none">
            {/* Center "Paper" Glow - White bright spot in center */}
            <div 
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[70vw] rounded-full bg-white blur-[100px] transition-transform duration-300 ease-out will-change-transform"
                style={{ 
                  transform: `translate(-50%, -50%) scale(${bgGlowScale})`
                }}
            />
            {/* Warm Vignette (Cream darker edges) */}
            <div 
                className="absolute inset-0 z-10 will-change-[background]"
                style={{ 
                    background: `radial-gradient(circle at center, transparent ${100 - vignetteIntensity}%, #EFEAE1 118%)`,
                    WebkitMaskImage:
                      'linear-gradient(to top, rgba(0,0,0,0.86) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,1) 100%)',
                    maskImage:
                      'linear-gradient(to top, rgba(0,0,0,0.86) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,1) 100%)'
                }}
            />
        </div>

        {/* --- MAIN STAGE --- */}
        <div className="relative z-20 w-full max-w-7xl h-full flex items-center justify-center perspective-1000" style={{ transform: 'translateY(24px)' }}>
          
          {/* ICONS GROUP */}
          <div className="absolute inset-0 pointer-events-none">
             {icons.map((item, i) => {
                 const flareScale = 1 + 0.08 * flareBoost;
                 const flareBiasX = 1.12;
                 const flareBiasY = 0.74;
                 const currentX = mapRange(exitProgress, 0, 1, item.x, item.destX * flareScale * flareBiasX);
                 const currentY = mapRange(exitProgress, 0, 1, item.y, item.destY * flareScale * flareBiasY);
                 const seed = item.id * 17.13;
                 const speedMul = lerp(0.85, 1.15, prand(seed + 1));
                 const dir = (item.id % 2 === 0 ? 1 : -1) * (prand(seed + 2) < 0.5 ? 1 : -1);
                 const distN = clamp(
                   Math.hypot(item.destX, item.destY) / Math.hypot(71, 79),
                   0,
                   1
                 );
                 const maxRot = lerp(15, 45, distN) * dir;

                 const rotT = clamp(((progress - 0.10) / (0.55 - 0.10)) * speedMul, 0, 1);
                 const rotE = easeOutCubic(rotT);

                 const settleT = smoothStep(0.48, 0.6, progress);
                 const wobble = Math.sin(rotT * 8) * 2 * (1 - rotT) * (1 - settleT);

                 const currentR = (rotE * maxRot + wobble) * (1 + 0.06 * flareBoost);
                 const currentScale = mapRange(exitProgress, 0, 1, item.scale, item.scale * (0.8 - 0.04 * flareBoost));

                 return (
                     <div
                      key={item.id}
                      className="absolute left-1/2 top-1/2 will-change-transform"
                      style={{
                          transform: `translate3d(${currentX}vw, ${currentY}vh, 0) rotate(${currentR}deg) scale(${currentScale})`,
                          opacity: iconGlobalOpacity,
                          filter: iconBlur > 0.01 ? `blur(${iconBlur}px)` : 'none',
                          width: 66,
                          height: 66,
                          marginLeft: -33,
                          marginTop: -33,
                      }}
                    >
                        {item.type === 'image' && item.src ? (
                          <img
                             src={item.src}
                             alt=""
                             className="w-full h-full object-contain"
                             draggable={false}
                             onError={(e) => {
                               (e.currentTarget as HTMLImageElement).style.display = 'none';
                             }}
                           />
                         ) : (
                           <IconTile 
                             icon={item.Icon!} 
                             color={item.color} 
                             floatDelay={i % 3}
                             className="w-full h-full"
                           />
                         )}
                     </div>
                 )
             })}
          </div>

          {/* HEADLINE */}
          <div 
            className="absolute z-30 flex flex-col items-center text-center will-change-transform"
            style={{ 
                opacity: headlineOpacity,
                transform: `scale(${headlineScale})`,
                filter: `blur(${headlineBlur}px)`,
                pointerEvents: headlineOpacity < 0.1 ? 'none' : 'auto'
            }}
          >
             <div className="text-stone-500 font-semibold tracking-[0.2em] text-[10px] md:text-xs mb-6 uppercase">
                2015 is over...
             </div>
             
             <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-stone-900 tracking-tight leading-[1.05]">
                You Don't Need<br/>
                <span className="text-stone-600">7+ Tools and Tabs</span>
             </h1>
             
             <div className="mt-8 text-stone-500 text-lg md:text-xl font-light max-w-md mx-auto leading-relaxed">
                Fragmented workflows are costing you hours.<br/>
                <span className="italic text-stone-400 text-base">It doesn't need to be like this.</span>
             </div>
          </div>

          {/* LOCKUP */}
          <div 
            className="absolute z-40 flex flex-col items-center justify-center will-change-transform"
            style={{ 
                opacity: lockupOpacity,
                transform: `translateY(${lockupY}px) scale(${lockupScale})`,
                pointerEvents: lockupOpacity < 0.5 ? 'none' : 'auto'
            }}
          >
              <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 mb-4">
                  <span className="font-serif text-5xl md:text-7xl text-stone-900 tracking-tighter">Meet</span>
                  
                  {/* Hero Logo Block (Dark Mode Inverse) */}
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-stone-900 text-white rounded-2xl border border-stone-800 shadow-2xl flex items-center justify-center relative overflow-hidden">
                        <img
                          src="/star.png"
                          alt="Phraze"
                          className="relative z-10 w-11 h-11 md:w-12 md:h-12 object-contain"
                          draggable={false}
                          style={{ filter: 'brightness(0) invert(1)' }}
                        />
                    </div>

                    <span className="font-serif text-5xl md:text-7xl text-stone-900 tracking-tighter">phraze</span>
                  </div>
              </div>

              {/* Subtext Reveal */}
              <div 
                className="text-center mt-6 will-change-[opacity,transform]"
                style={{ 
                    opacity: subtextOpacity,
                    transform: `translateY(${subtextY}px)`
                }}
              >
                  <h2 className="text-xl md:text-2xl text-stone-700 font-light tracking-wide">
                    One place for all your annotation work
                  </h2>
                  <div className="flex items-center justify-center gap-3 mt-4 text-stone-400 text-xs md:text-sm tracking-widest uppercase font-medium">
                    <span>Highlight</span>
                    <span className="w-1 h-1 rounded-full bg-stone-300" />
                    <span>Label</span>
                    <span className="w-1 h-1 rounded-full bg-stone-300" />
                    <span>Review</span>
                    <span className="w-1 h-1 rounded-full bg-stone-300" />
                    <span>Export</span>
                  </div>
              </div>
              
              {/* CTA Button */}
              <div
                style={{
                  opacity: clamp(mapRange(progress, 0.85, 0.95, 0, 1), 0, 1),
                  transform: `translateY(${mapRange(progress, 0.85, 0.95, 10, 0)}px)`,
                }}
              >
                <ExpandableScreenTrigger layoutId="get-started-free-button">
                  <button 
                     className="mt-10 px-8 py-3.5 rounded-full bg-stone-900 text-white font-medium hover:bg-stone-800 transition-all shadow-xl shadow-stone-900/10"
                     type="button"
                  >
                      Get Started Free
                  </button>
                </ExpandableScreenTrigger>
              </div>
          </div>

        </div>
      </div>
      
      {/* Spacer */}
      <div className="h-[20vh] w-full bg-[#FFFEFC]" />
    </div>
  );
};

export default ScrollHero;