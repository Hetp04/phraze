import React from 'react';
import ScrollHero from './components/ScrollHero';
import Grain from './components/Grain';

function App() {
  return (
    <main className="w-full min-h-screen bg-cream-50 text-stone-900 selection:bg-stone-200">
      <Grain />
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 px-6 py-6 flex justify-between items-center pointer-events-none">
         <div className="font-serif font-bold text-xl tracking-tight pointer-events-auto cursor-pointer text-stone-900">phraze.</div>
         <div className="flex gap-6 text-sm font-medium pointer-events-auto text-stone-600" style={{ fontFamily: '"Glacial Indifference", sans-serif' }}>
             <a href="#" className="hover:text-stone-900 transition-colors">Product</a>
             <a href="#" className="hover:text-stone-900 transition-colors">Pricing</a>
             <a href="#" className="hover:text-stone-900 transition-colors">Login</a>
         </div>
      </nav>

      {/* Hero Section */}
      <ScrollHero />

      {/* Content Section (Dark for contrast at bottom) */}
      <section className="relative z-10 w-full bg-stone-900 py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-3xl font-serif mb-6 text-white/90">Everything you need, nothing you don't.</h3>
            <p className="text-white/50 leading-relaxed">
                Most annotation tools are bloated with features you'll never use. 
                Phraze strips it back to the essentials while keeping the power you need for complex datasets.
            </p>
        </div>
        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[1,2,3].map(i => (
                <div key={i} className="h-64 rounded-2xl bg-white/5 border border-white/5 p-8">
                    <div className="w-12 h-12 bg-white/10 rounded-full mb-6"></div>
                    <div className="h-4 w-1/2 bg-white/20 rounded mb-4"></div>
                    <div className="h-2 w-3/4 bg-white/10 rounded mb-2"></div>
                    <div className="h-2 w-2/3 bg-white/10 rounded"></div>
                </div>
            ))}
        </div>
      </section>
    </main>
  );
}

export default App;