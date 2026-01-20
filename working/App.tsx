import React from 'react';
import Hero from './components/Hero';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-[#fcfcfc] text-slate-900 overflow-x-hidden">
      <main className="flex-grow flex items-center justify-center relative">
        <Hero />
      </main>
    </div>
  );
}