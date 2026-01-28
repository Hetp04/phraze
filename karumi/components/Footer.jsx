import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import phrazeLogo from '../../extension/reallogo.png';

export default function Footer(
  {
    backgroundImageSrc = '/flower.jpg',
    headlineLine1 = 'Accelerate your growth',
    headlineLine2 = 'with a live demo.',
    showTypography = false,
    showStencil = false,
  } = {}
) {
  const navigate = useNavigate();

  return (
    <div className="w-full bg-[#FFFEFC] relative overflow-hidden border-t border-gray-50">
      {showStencil && (
        <div className="absolute left-0 bottom-0 w-[240px] h-[220px] overflow-hidden pointer-events-none z-20">
          <img
            src="/stencil.png"
            alt=""
            className="absolute left-0 bottom-0 w-[720px] h-auto max-w-none opacity-25"
            style={{ objectFit: 'cover', objectPosition: 'left bottom' }}
            aria-hidden="true"
          />
          <div
            className="absolute top-0 left-0 w-full h-[80px]"
            style={{ background: 'linear-gradient(to bottom, #FFFDFA 0%, rgba(255,253,250,0) 100%)' }}
            aria-hidden="true"
          />
        </div>
      )}
      <div className="relative overflow-hidden pt-32 pb-48">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div
            className="absolute bottom-0 left-0 w-full h-[720px]"
            style={{
              backgroundImage: `url("${backgroundImageSrc}")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center bottom',
              backgroundSize: 'cover',
              opacity: 0.28,
              filter: 'brightness(1.25) contrast(0.95) saturate(0.9)',
              WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.9) 60%, rgba(0,0,0,0) 100%)',
              maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.9) 60%, rgba(0,0,0,0) 100%)',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskSize: '100% 100%',
              maskSize: '100% 100%',
            }}
          />

          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-64 w-[2800px] h-[1050px]"
            style={{
              background:
                'radial-gradient(ellipse at 50% 100%, rgba(34,211,238,0.68) 0%, rgba(34,211,238,0.32) 34%, rgba(34,211,238,0.14) 58%, rgba(255,255,255,0) 80%)',
              filter: 'blur(34px)',
              opacity: 0.95,
            }}
          />

          <div
            className="absolute top-0 left-0 w-full h-full"
            style={{ background: 'linear-gradient(to bottom, rgba(34,211,238,0.12) 0%, rgba(255,255,255,0) 60%)' }}
          />

          <div
            className="absolute top-0 left-0 w-full h-[80px]"
            style={{ background: 'linear-gradient(to bottom, #FFFEFC 0%, rgba(255,255,255,0) 80%)' }}
          />

          <div
            className="absolute bottom-0 left-0 w-full h-[340px]"
            style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, #FFFEFC 100%)' }}
          />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center px-6">
          <h2 className="text-5xl md:text-7xl font-serif text-slate-900 mb-8 tracking-tight leading-[1.1]">
            {headlineLine1} <br /> {headlineLine2}
          </h2>
          <button
            className="bg-[#1a1a1a] text-white px-8 py-4 rounded-xl font-medium text-sm hover:bg-black transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 duration-300 inline-flex items-center gap-2"
            type="button"
            onClick={() => navigate('/demo')}
          >
            Talk to us
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 relative z-10 mt-24 pb-44">
        {showTypography && (
          <div
            aria-hidden="true"
            className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[120vw] text-center select-none pointer-events-none"
            style={{
              fontFamily: 'Times New Roman, Times, serif',
              fontSize: 'clamp(100px, 18vw, 320px)',
              fontWeight: 700,
              letterSpacing: '-0.06em',
              lineHeight: 0.9,
              opacity: 0.52,
              backgroundImage:
                'linear-gradient(180deg, rgba(34,211,238,0.35) 0%, rgba(34,211,238,0.45) 55%, rgba(34,211,238,0.25) 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              WebkitTextFillColor: 'transparent',
              maskImage: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0) 100%)',
              WebkitMaskImage:
                'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0) 100%)',
            }}
          >
            PHRAZE
          </div>
        )}

        <div className="w-full max-w-[1150px] mx-auto flex flex-col md:flex-row md:items-start md:justify-between border-t border-gray-100 pt-8 gap-10">
          <div className="flex flex-col gap-4 text-center md:text-left md:-mt-6">
            <div className="flex items-center justify-center md:justify-start -mb-2 md:-ml-4 md:-mt-2">
              <img src={phrazeLogo} alt="Phraze" className="h-[80px] w-auto object-contain" />
            </div>
            <p className="text-sm text-slate-400 font-medium -mt-6">
              © 2024 Phraze AI Inc.
            </p>
            <p className="text-sm text-slate-500 font-medium leading-relaxed -mt-4">
              Collaborative AI workspace.
            </p>
            <div className="flex items-center justify-center md:justify-start gap-3">
              <a
                href="https://www.producthunt.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Product Hunt"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.001 4.8c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624C13.666 10.618 15.027 12 18.001 12c3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C16.337 6.182 14.976 4.8 12.001 4.8zm-6 7.2c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624 1.177 1.194 2.538 2.576 5.512 2.576 3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C10.337 13.382 8.976 12 6.001 12z" />
                </svg>
              </a>
              <a
                href="https://www.linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="LinkedIn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>

          <div className="flex flex-wrap justify-center md:justify-end gap-16 lg:gap-32">
            <div className="flex flex-col gap-4 text-center md:text-left">
              <h4 className="font-bold text-slate-900 text-sm">Company</h4>
              <ul className="space-y-3 text-sm text-slate-500 font-medium">
                <li>
                  <Link to="/about" className="hover:text-slate-900 transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-slate-900 transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-4 text-center md:text-left">
              <h4 className="font-bold text-slate-900 text-sm">Legal</h4>
              <ul className="space-y-3 text-sm text-slate-500 font-medium">
                <li>
                  <Link to="/privacy" className="hover:text-slate-900 transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="hover:text-slate-900 transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to="/cookies" className="hover:text-slate-900 transition-colors">
                    Cookie Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-50 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-medium pb-8">
          <p style={{ visibility: showTypography ? 'hidden' : 'visible' }}>
            © 2024 Phraze AI Inc. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
