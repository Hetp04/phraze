import React from 'react';
import { Cloud, Box, Hexagon, Command, Cpu } from 'lucide-react';

export const TrustedBy: React.FC = () => {
  return (
    <section className="bg-[#fcfbf8] border-t border-gray-200">
      <div className="max-w-[950px] mx-auto">
        
        {/* Caption */}
        <div className="text-center pt-10 pb-6 px-6">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-[0.2em]">Trusted by forward-thinking teams</span>
        </div>

        {/* Logos Grid - Exact borders to match the parent grid (using gray-200) */}
        <div className="grid grid-cols-2 md:grid-cols-5 border-y border-gray-200">
            
            {/* Logo 1 */}
            <div className="h-28 flex items-center justify-center p-6 border-r border-b md:border-b-0 border-gray-200 group hover:bg-white/50 transition-colors">
                <div className="flex items-center gap-2 text-gray-400 group-hover:text-gray-900 transition-colors grayscale opacity-60 group-hover:opacity-100 group-hover:grayscale-0">
                    <Cloud className="w-6 h-6" />
                    <span className="font-semibold text-lg">AcmeCloud</span>
                </div>
            </div>

            {/* Logo 2 */}
            <div className="h-28 flex items-center justify-center p-6 border-r border-b md:border-b-0 border-gray-200 group hover:bg-white/50 transition-colors">
                <div className="flex items-center gap-2 text-gray-400 group-hover:text-gray-900 transition-colors grayscale opacity-60 group-hover:opacity-100 group-hover:grayscale-0">
                    <Hexagon className="w-6 h-6" />
                    <span className="font-bold text-lg tracking-tight">Kinetix</span>
                </div>
            </div>

            {/* Logo 3 */}
            <div className="h-28 flex items-center justify-center p-6 border-r border-b md:border-b-0 border-gray-200 group hover:bg-white/50 transition-colors">
                <div className="flex items-center gap-2 text-gray-400 group-hover:text-gray-900 transition-colors grayscale opacity-60 group-hover:opacity-100 group-hover:grayscale-0">
                     <span className="font-serif italic text-xl">Vogue</span>
                </div>
            </div>

            {/* Logo 4 */}
            <div className="h-28 flex items-center justify-center p-6 border-r border-b md:border-b-0 border-gray-200 group hover:bg-white/50 transition-colors">
                 <div className="flex items-center gap-2 text-gray-400 group-hover:text-gray-900 transition-colors grayscale opacity-60 group-hover:opacity-100 group-hover:grayscale-0">
                    <Box className="w-6 h-6" />
                    <span className="font-semibold text-lg">Stacker</span>
                </div>
            </div>

            {/* Logo 5 */}
            <div className="h-28 flex items-center justify-center p-6 group hover:bg-white/50 transition-colors">
                 <div className="flex items-center gap-2 text-gray-400 group-hover:text-gray-900 transition-colors grayscale opacity-60 group-hover:opacity-100 group-hover:grayscale-0">
                    <Cpu className="w-6 h-6" />
                    <span className="font-medium text-lg">Tely.ai</span>
                </div>
            </div>

        </div>
        
        {/* Visual spacer to bottom of page if needed, or simple padding */}
        <div className="h-24 bg-[#fcfbf8] flex border-x border-transparent">
             {/* Intentionally empty to show white space */}
        </div>
      </div>
    </section>
  );
};