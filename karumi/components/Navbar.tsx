import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExpandableScreenTrigger } from '../../src/components/ui/expandable-screen.jsx';

export const Navbar: React.FC = () => {
  const [isCompact, setIsCompact] = useState(false);
  const [isOnWhiteSection, setIsOnWhiteSection] = useState(false);

  useEffect(() => {
    const ON_AT = 48;
    const OFF_AT = 8;
    const NAV_H = 80;

    const update = () => {
      const y = window.scrollY;
      setIsCompact((prev) => {
        if (!prev && y > ON_AT) return true;
        if (prev && y < OFF_AT) return false;
        return prev;
      });

      const chatDemoEl = document.querySelector('.chat-demo');
      if (chatDemoEl) {
        const rect = chatDemoEl.getBoundingClientRect();
        setIsOnWhiteSection(rect.top <= NAV_H);
      } else {
        setIsOnWhiteSection(false);
      }
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <header className={`karumi-navbar fixed top-0 left-0 right-0 z-50 transition-all duration-300 supports-[backdrop-filter]:backdrop-blur supports-[backdrop-filter]:backdrop-saturate-150 ${
      isCompact ? 'border-b border-gray-200/70 shadow-sm' : 'border-b border-transparent'
    } ${
      isCompact ? 'supports-[backdrop-filter]:bg-[#FFFEFC]/90 bg-[#FFFEFC]/98' : 'supports-[backdrop-filter]:bg-[#FFFEFC]/78 bg-[#FFFEFC]/92'
    }`}>
      <div
        className={`pointer-events-none absolute left-0 right-0 bottom-0 h-px bg-gray-200/80 transition-opacity duration-300 ${
          isCompact ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <div className="max-w-[1150px] mx-auto px-6 h-20 flex justify-between items-center border-x border-gray-200">
          
          {/* Left: Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="flex items-center gap-2.5 group -ml-3">
               {/* Custom Hexagon/P Icon inspired by reference */}
               <div className="relative h-[34px] flex items-center justify-center">
                 <img src="/p.png" alt="Phraze" className="logo-img h-full w-auto object-contain" />
               </div>
            </Link>
          </div>

          {/* Center: Navigation Links */}
          <div className="relative hidden md:flex flex-1 justify-center">
            <nav
              className={`absolute inset-0 flex items-center justify-center gap-10 transition-opacity duration-200 ${
                isCompact ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
            >
              <Link to="/" className="text-base font-medium text-gray-500 hover:text-gray-900 transition-colors" style={{ fontFamily: '"Glacial Indifference", sans-serif' }}>Home</Link>
              <Link to="/about" className="text-base font-medium text-gray-500 hover:text-gray-900 transition-colors" style={{ fontFamily: '"Glacial Indifference", sans-serif' }}>About</Link>
              <Link to="/contact" className="text-base font-medium text-gray-500 hover:text-gray-900 transition-colors" style={{ fontFamily: '"Glacial Indifference", sans-serif' }}>Contact</Link>
            </nav>

            <nav
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
                isCompact ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-transparent px-2 py-1 shadow-sm">
                <Link to="/" className="text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70 px-3 py-1.5 rounded-full transition-colors" style={{ fontFamily: '"Glacial Indifference", sans-serif' }}>Home</Link>
                <Link to="/about" className="text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70 px-3 py-1.5 rounded-full transition-colors" style={{ fontFamily: '"Glacial Indifference", sans-serif' }}>About</Link>
                <Link to="/contact" className="text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70 px-3 py-1.5 rounded-full transition-colors" style={{ fontFamily: '"Glacial Indifference", sans-serif' }}>Contact</Link>
              </div>
            </nav>
          </div>

          {/* Right: Login Button (Cult UI ExpandableScreenTrigger) */}
          <div className="flex items-center">
            <ExpandableScreenTrigger layoutId="login-button">
              <div
                id="login-button"
                className={`text-sm font-medium px-5 py-2 rounded-lg transition-all duration-300 ${
                  isCompact
                    ? 'bg-gray-900 hover:bg-gray-800 text-white shadow-sm'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-transparent'
                }`}
                style={{ fontFamily: '"Glacial Indifference", sans-serif' }}
              >
                Login
              </div>
            </ExpandableScreenTrigger>
          </div>

        </div>
      </header>
  );
};