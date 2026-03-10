import React from 'react';
import { ArrowRight, PlayCircle, Sparkles } from 'lucide-react';
import { ExpandableScreenTrigger } from '../../src/components/ui/expandable-screen.jsx';
import collaborationPanelImage from '../../videos/1.png';

export const Hero: React.FC = () => {
  return (
    <section className="relative max-w-[1150px] mx-auto px-6 pt-4 pb-8">

      {/* One frame: verticals + bottom – same element so they always connect */}
      <div className="absolute -top-[200px] left-1/2 -translate-x-1/2 bottom-0 w-full max-w-[1150px] pointer-events-none z-0">
        <div className="absolute inset-0 border border-gray-200 border-t-transparent">
          <div className="absolute left-0 top-0 bottom-0 w-px overflow-hidden">
            <div
              className="absolute left-0 w-px h-full bg-gradient-to-b from-transparent via-[#14B8A6] to-transparent animate-beam-v"
              style={{ animationDelay: '0s' }}
            />
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-px overflow-hidden">
            <div
              className="absolute left-0 w-px h-full bg-gradient-to-b from-transparent via-[#14B8A6] to-transparent animate-beam-v"
              style={{ animationDelay: '3s' }}
            />
          </div>
        </div>
      </div>

      {/* Horizontal line – middle */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-[46%] -translate-y-1/2 w-screen h-px hidden md:block pointer-events-none z-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, #e5e7eb 0, #e5e7eb calc((100% - 1150px) / 2), transparent calc((100% - 1150px) / 2), transparent calc(100% - ((100% - 1150px) / 2)), #e5e7eb calc(100% - ((100% - 1150px) / 2)), #e5e7eb 100%)',
        }}
      />
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

      {/* Bottom line teal beam animation only (solid line is on the frame above) */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-full max-w-[1150px] h-px hidden md:block pointer-events-none z-[5] overflow-hidden">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 h-[1px] w-[800px] bg-gradient-to-r from-transparent via-[#14B8A6] to-transparent animate-beam-h"
          style={{ animationDelay: '2.6s' }}
        />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 h-[1px] w-[800px] bg-gradient-to-r from-transparent via-[#14B8A6] to-transparent animate-beam-h"
          style={{ animationDelay: '0.9s' }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="mx-auto max-w-[900px] text-center flex flex-col items-center pt-10 md:pt-14">
        
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 bg-white shadow-[0_6px_18px_rgba(91,163,245,0.14)] mb-6 hover:shadow-[0_10px_26px_rgba(91,163,245,0.18)] transition-all cursor-default">
            <Sparkles className="w-4 h-4 text-[#5B9AA0] fill-cyan-50" />
            <span className="text-sm font-medium text-gray-600">Early Access</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-[450] text-gray-900 leading-[1.08] mb-5 tracking-tight" style={{ fontFamily: '"Glacial Indifference", sans-serif' }}>
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

          <p className="text-base md:text-lg text-gray-500 mb-8 max-w-2xl mx-auto leading-relaxed font-light" style={{ fontFamily: '"Glacial Indifference", sans-serif' }}>
            The collaborative platform where teams annotate, share insights, and build on AI conversations together-all in real time.
          </p>

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
            
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('how-it-works');
                if (el) {
                  const y = el.getBoundingClientRect().top + window.scrollY - 80;
                  window.scrollTo(0, y);
                }
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-200 px-8 py-3.5 rounded-lg font-medium text-base hover:bg-gray-50 transition-colors hover:text-gray-900 shadow-sm"
            >
              <PlayCircle className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
              See How It Works
            </button>
          </div>
        </div>

        {/* Image + fade: no shadow, smooth fade into page */}
        <div className="relative z-10 w-full mt-8 md:mt-10">
          <div className="relative w-full max-w-[1100px] mx-auto rounded-xl border-t border-x border-gray-200 overflow-hidden bg-white">
            <img
              src={collaborationPanelImage}
              alt="Real-time collaboration - annotate and build on AI conversations together"
              className="block w-full h-auto"
            />
            {/* Smooth fade: gradual transition so no visible edge */}
            <div
              className="absolute inset-x-0 bottom-0 top-[75%] pointer-events-none rounded-b-xl"
              style={{
                background: 'linear-gradient(to top, #FFFDF8 0%, rgba(255,253,248,0.98) 8%, rgba(255,253,248,0.92) 18%, rgba(255,253,248,0.78) 32%, rgba(255,253,248,0.55) 48%, rgba(255,253,248,0.3) 65%, rgba(255,253,248,0.12) 82%, transparent 100%)',
              }}
            />
          </div>
        </div>
      </div>

    </section>
  );
};