import React from 'react';
import { ArrowRight, PlayCircle, MessageSquare, PenTool, Users, BookOpen, Sparkles } from 'lucide-react';
import { ExpandableScreenTrigger } from '../../src/components/ui/expandable-screen.jsx';

export const Hero: React.FC = () => {
  return (
    <section className="relative pt-[80px] min-h-[calc(100vh-80px)] max-w-[1150px] mx-auto px-6">

      <div className="absolute inset-0 pointer-events-none z-0 flex justify-center w-full">
         <div className="w-full max-w-[1150px] h-full border-x border-gray-200 relative">
            <div className="absolute inset-0">
              <div className="absolute left-0 top-0 bottom-0 w-px overflow-visible" style={{ transform: 'translateX(-50%)' }}>
                <div
                  className="absolute left-0 w-[1px] h-full bg-gradient-to-b from-transparent via-[#14B8A6] to-transparent animate-beam-v"
                  style={{ animationDelay: '0s' }}
                />
              </div>
              <div className="absolute right-0 top-0 bottom-0 w-px overflow-visible" style={{ transform: 'translateX(50%)' }}>
                <div
                  className="absolute left-0 w-[1px] h-full bg-gradient-to-b from-transparent via-[#14B8A6] to-transparent animate-beam-v"
                  style={{ animationDelay: '3s' }}
                />
              </div>
            </div>
         </div>
      </div>

      <div className="relative pb-[360px] lg:pb-[400px] min-h-[calc(100vh-80px)]">

        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-0 w-screen h-28 bg-gradient-to-b from-transparent to-[#FFFEFC] z-0" />
      
      {/* 
        Horizontal Grid Line 
        Connects the two vertical grid lines at the height of the bottom icons.
        Hidden on mobile to match icon visibility.
      */}
      <div className="absolute left-0 right-0 bottom-64 lg:bottom-80 2xl:bottom-[17rem] h-px bg-gray-200 hidden md:block"></div>

      {/* Beam overlay for the existing horizontal grid line (does not affect the line itself) */}
      <div className="absolute left-0 right-0 bottom-64 lg:bottom-80 2xl:bottom-[17rem] h-px hidden md:block pointer-events-none overflow-hidden z-0">
        <div
          className="absolute top-0 h-[1px] w-[800px] bg-gradient-to-r from-transparent via-[#14B8A6] to-transparent animate-beam-h"
          style={{ animationDelay: '2.6s' }}
        />
        <div
          className="absolute top-0 h-[1px] w-[800px] bg-gradient-to-r from-transparent via-[#14B8A6] to-transparent animate-beam-h"
          style={{ animationDelay: '0.9s' }}
        />
      </div>

      {/* Horizontal grid ticks between left/right icon pairs */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-[46%] -translate-y-1/2 w-screen h-px hidden md:block"
        style={{
          backgroundImage:
            'linear-gradient(to right, #e5e7eb 0, #e5e7eb calc((100% - 1150px) / 2), transparent calc((100% - 1150px) / 2), transparent calc(100% - ((100% - 1150px) / 2)), #e5e7eb calc(100% - ((100% - 1150px) / 2)), #e5e7eb 100%)',
        }}
      ></div>

      {/* Beam overlay for the existing ticked horizontal line (does not affect the line itself) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-[46%] -translate-y-1/2 w-screen h-px hidden md:block pointer-events-none overflow-hidden z-0"
        style={{
          WebkitMaskImage:
            'linear-gradient(to right, #000 0, #000 calc((100% - 1150px) / 2), transparent calc((100% - 1150px) / 2), transparent calc(100% - ((100% - 1150px) / 2)), #000 calc(100% - ((100% - 1150px) / 2)), #000 100%)',
          maskImage:
            'linear-gradient(to right, #000 0, #000 calc((100% - 1150px) / 2), transparent calc((100% - 1150px) / 2), transparent calc(100% - ((100% - 1150px) / 2)), #000 calc(100% - ((100% - 1150px) / 2)), #000 100%)',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
        }}
      >
        <div className="absolute top-0 h-[1px] w-[800px] bg-gradient-to-r from-transparent via-[#14B8A6] to-transparent animate-beam-h" />
        <div
          className="absolute top-0 h-[1px] w-[800px] bg-gradient-to-r from-transparent via-[#14B8A6] to-transparent animate-beam-h"
          style={{ animationDelay: '2.1s' }}
        />
      </div>

      {/* 
        Floating Icons 
        Positioned absolutely relative to the section container to frame the content.
        Hidden on mobile to preserve clean layout, visible on md/lg screens.
      */}

      {/* Top Left: Chat - Rotated CCW */}
      <div className="absolute top-24 lg:top-16 2xl:top-6 left-0 md:-left-10 lg:-left-16 2xl:-left-[36px] hidden md:flex w-[72px] h-[72px] bg-white rounded-2xl border border-gray-100/50 items-center justify-center transform -rotate-12 hover:rotate-0 transition-transform duration-500 z-0">
         <MessageSquare className="w-7 h-7 text-gray-300 fill-gray-50" />
      </div>

      {/* Top Right: Pen - Rotated CW */}
      <div className="absolute top-24 lg:top-16 2xl:top-6 right-0 md:-right-10 lg:-right-16 2xl:-right-[36px] hidden md:flex w-[72px] h-[72px] bg-white rounded-2xl border border-gray-100/50 items-center justify-center transform rotate-12 hover:rotate-0 transition-transform duration-500 z-0">
         <PenTool className="w-7 h-7 text-gray-300 fill-gray-50" />
      </div>

      {/* Bottom Left: Users - Rotated CW */}
      <div className="absolute bottom-56 lg:bottom-80 2xl:bottom-[calc(17rem-36px)] left-0 md:-left-10 lg:-left-16 2xl:-left-[36px] hidden md:flex w-[72px] h-[72px] bg-white rounded-2xl border border-gray-100/50 items-center justify-center transform rotate-6 hover:rotate-0 transition-transform duration-500 z-0">
         <Users className="w-7 h-7 text-gray-300 fill-gray-50" />
      </div>

      {/* Bottom Right: Book - Rotated CCW */}
      <div className="absolute bottom-56 lg:bottom-80 2xl:bottom-[calc(17rem-36px)] right-0 md:-right-10 lg:-right-16 2xl:-right-[36px] hidden md:flex w-[72px] h-[72px] bg-white rounded-2xl border border-gray-100/50 items-center justify-center transform -rotate-6 hover:rotate-0 transition-transform duration-500 z-0">
         <BookOpen className="w-7 h-7 text-gray-300 fill-gray-50" />
      </div>

      <div className="mx-auto max-w-[900px] text-center relative z-10 flex flex-col items-center pt-[190px] lg:pt-[150px] 2xl:pt-[130px]">
        
        {/* Early Access Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 bg-white shadow-[0_6px_18px_rgba(91,163,245,0.14)] mb-8 hover:shadow-[0_10px_26px_rgba(91,163,245,0.18)] transition-all cursor-default">
          <Sparkles className="w-4 h-4 text-[#5B9AA0] fill-cyan-50" />
          <span className="text-sm font-medium text-gray-600">Early Access</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-[450] text-gray-900 leading-[1.1] mb-6 tracking-tight">
          Turn every{' '}
          <span
            style={{
              backgroundImage:
                'linear-gradient(rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.25)), linear-gradient(rgba(74, 144, 226, 0.3), rgba(91, 163, 245, 0.3)), url("/grey22.jpg")',
              backgroundSize: 'cover, cover, 150%',
              backgroundPosition: 'center center, center center, 50% 50%',
              backgroundBlendMode: 'darken, overlay, normal',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
              display: 'inline-block',
            }}
          >
            AI conversation
          </span>{' '}
          <br className="hidden md:block" />
          into a workspace together
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed font-light">
          The collaborative platform where teams annotate, share insights, and build on AI conversations together—all in real time.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <ExpandableScreenTrigger
            layoutId="start-annotating-button"
            style={{ display: 'inline-block', borderRadius: '8px' }}
          >
            <button
              id="start-annotating-button"
              className="group inline-flex items-center justify-center gap-2 bg-gray-900 text-white px-8 py-3.5 rounded-lg font-medium text-base hover:bg-gray-800 transition-all hover:gap-3 hover:shadow-lg"
              type="button"
            >
              Start Annotating
              <ArrowRight className="w-4 h-4" />
            </button>
          </ExpandableScreenTrigger>
          
          <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-200 px-8 py-3.5 rounded-lg font-medium text-base hover:bg-gray-50 transition-colors hover:text-gray-900 shadow-sm">
            <PlayCircle className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
            See How It Works
          </button>
        </div>

      </div>

      </div>

    </section>
  );
};