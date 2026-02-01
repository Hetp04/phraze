import React from 'react';
import { ArrowRight, Play, Sparkles, MessageSquare, PenTool, Users, BookOpen } from 'lucide-react';
import FloatingIcon from './FloatingIcon';

const Hero: React.FC = () => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative py-20 px-4 overflow-hidden">
      
      <style>{`
        @keyframes beam-h {
          0% { left: -1000px; opacity: 0; }
          5% { opacity: 0; }
          50% { opacity: 1; }
          95% { opacity: 0; }
          100% { left: 100%; opacity: 0; }
        }
        @keyframes beam-v {
          0% { top: -1000px; opacity: 0; }
          5% { opacity: 0; }
          50% { opacity: 1; }
          95% { opacity: 0; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-beam-h {
          animation: beam-h 8s linear infinite;
        }
        .animate-beam-v {
          animation: beam-v 8s linear infinite;
        }
      `}</style>

      {/* 
        The design has a central box defined by very subtle borders that extend to infinity (or screen edge).
      */}
      <div className="w-full max-w-[1000px] relative">
        
        {/* Horizontal Line Top */}
        <div className="absolute top-0 left-[-100vw] right-[-100vw] h-[1px] bg-slate-200 overflow-visible">
            <div className="absolute top-1/2 -translate-y-1/2 h-[2px] w-[800px] bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-beam-h shadow-[0_0_4px_rgba(45,212,191,0.5)]" />
        </div>
        
        {/* Horizontal Line Bottom */}
        <div className="absolute bottom-0 left-[-100vw] right-[-100vw] h-[1px] bg-slate-200 overflow-visible">
            <div className="absolute top-1/2 -translate-y-1/2 h-[2px] w-[800px] bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-beam-h shadow-[0_0_4px_rgba(45,212,191,0.5)]" style={{ animationDelay: '4s' }} />
        </div>
        
        {/* Vertical Line Left */}
        <div className="absolute left-0 top-[-100vh] bottom-[-100vh] w-[1px] bg-slate-200 overflow-visible">
            <div className="absolute left-1/2 -translate-x-1/2 w-[2px] h-[800px] bg-gradient-to-b from-transparent via-teal-400 to-transparent animate-beam-v shadow-[0_0_4px_rgba(45,212,191,0.5)]" style={{ animationDelay: '2s' }} />
        </div>
        
        {/* Vertical Line Right */}
        <div className="absolute right-0 top-[-100vh] bottom-[-100vh] w-[1px] bg-slate-200 overflow-visible">
            <div className="absolute left-1/2 -translate-x-1/2 w-[2px] h-[800px] bg-gradient-to-b from-transparent via-teal-400 to-transparent animate-beam-v shadow-[0_0_4px_rgba(45,212,191,0.5)]" style={{ animationDelay: '6s' }} />
        </div>

        {/* Corner Icons positioned absolutely on the intersection of the grid lines */}
        
        {/* Top Left - Chat Bubble */}
        <div className="absolute -top-10 -left-10 z-10">
            <FloatingIcon icon={<MessageSquare className="w-6 h-6 text-gray-400" />} rotate="-6deg" delay={0} />
        </div>

        {/* Top Right - Pen */}
        <div className="absolute -top-10 -right-10 z-10">
             <FloatingIcon icon={<PenTool className="w-6 h-6 text-gray-400" />} rotate="6deg" delay={0.5} />
        </div>

        {/* Bottom Left - Users */}
        <div className="absolute -bottom-10 -left-10 z-10">
             <FloatingIcon icon={<Users className="w-6 h-6 text-gray-400" />} rotate="3deg" delay={1} />
        </div>

        {/* Bottom Right - Book */}
        <div className="absolute -bottom-10 -right-10 z-10">
             <FloatingIcon icon={<BookOpen className="w-6 h-6 text-gray-400" />} rotate="-4deg" delay={1.5} />
        </div>


        {/* Main Content Area */}
        <div className="flex flex-col items-center text-center py-20 md:py-32 px-6">
          
          {/* Early Access Pill */}
          <div className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-gray-100 shadow-sm text-xs font-medium text-slate-600">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>Early Access</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl leading-[1.1] text-slate-900 mb-8 max-w-4xl tracking-tight" style={{ fontFamily: '"Glacial Indifference", sans-serif' }}>
            Turn every <span className="text-teal-600 italic">AI conversation</span> <br className="hidden md:block" />
            into a workspace together
          </h1>

          {/* Subtext */}
          <p className="text-gray-500 text-lg md:text-xl max-w-2xl leading-relaxed mb-10 font-light" style={{ fontFamily: '"Glacial Indifference", sans-serif' }}>
            The collaborative platform where teams annotate, share insights, and build on AI conversations together—all in real time.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button className="group px-6 py-3.5 bg-slate-900 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200/50">
              Start Annotating
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            
            <button className="group px-6 py-3.5 bg-white border border-gray-200 text-slate-700 rounded-lg font-medium flex items-center gap-2 hover:border-gray-300 hover:bg-gray-50 transition-all">
              <span className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center group-hover:border-gray-400">
                <Play className="w-2 h-2 text-gray-400 ml-0.5" fill="currentColor" />
              </span>
              See How It Works
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Hero;