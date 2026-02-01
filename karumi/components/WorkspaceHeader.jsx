import React from 'react';
import { Hexagon } from 'lucide-react';

export default function WorkspaceHeader() {
  return (
    <header className="w-full border-b border-gray-100 bg-[#fcfcfc] relative z-50">
      <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
          <div className="relative w-8 h-8 flex items-center justify-center">
            <div className="font-bold text-2xl font-serif tracking-tight flex items-center gap-1" style={{ fontFamily: '"Glacial Indifference", sans-serif' }}>
              <span className="relative flex items-center justify-center">
                <Hexagon className="w-6 h-6 fill-slate-800 text-slate-800" strokeWidth={0} />
                <span className="absolute text-white text-[10px] font-sans font-bold mb-[1px]">P</span>
              </span>
              <span>hraze</span>
            </div>
          </div>
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-500" style={{ fontFamily: '"Glacial Indifference", sans-serif' }}>
          <a href="#" className="hover:text-black transition-colors">Home</a>
          <a href="#" className="hover:text-black transition-colors">Features</a>
          <a href="#" className="hover:text-black transition-colors">About</a>
          <a href="#" className="hover:text-black transition-colors">Contact</a>
        </nav>

        <div>
          <button className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg transition-colors text-slate-700" style={{ fontFamily: '"Glacial Indifference", sans-serif' }}>
            Login
          </button>
        </div>
      </div>
    </header>
  );
}
