import React from 'react';
import { Hero } from './components/Hero';

function App() {
  return (
    <main className="w-full min-h-screen bg-[#FDFBF7] text-stone-900 selection:bg-stone-200 selection:text-black">
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-6 flex justify-between items-center pointer-events-none">
        <div className="font-serif-display text-2xl font-bold tracking-tight pointer-events-auto cursor-pointer text-stone-900">
          phraze.
        </div>
        <button className="pointer-events-auto bg-stone-900 hover:bg-stone-800 text-[#FDFBF7] px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 shadow-lg shadow-stone-200">
          Get Started
        </button>
      </nav>

      {/* The Scroll Hero Section */}
      <Hero />

      {/* Footer - Simplified */}
      <footer className="w-full py-12 text-center text-stone-400 text-sm bg-[#FDFBF7]">
        <p>© 2024 Phraze Inc. Crafted with precision.</p>
      </footer>
    </main>
  );
}

export default App;