import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Footer() {
  const navigate = useNavigate();

  return (
    <div className="w-full bg-white relative overflow-hidden border-t border-gray-50">
      <div className="relative overflow-hidden pt-32 pb-48">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
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
            style={{ background: 'linear-gradient(to bottom, #ffffff 0%, rgba(255,255,255,0) 80%)' }}
          />

          <div
            className="absolute bottom-0 left-0 w-full h-[340px]"
            style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, #ffffff 100%)' }}
          />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center px-6">
          <h2 className="text-5xl md:text-7xl font-serif text-slate-900 mb-8 tracking-tight leading-[1.1]">
            Accelerate your growth <br /> with a live demo.
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

      <div className="max-w-[1400px] mx-auto px-6 relative z-10 mt-24 pb-24">
        <div className="flex justify-center border-t border-gray-100 pt-16">
          <div className="flex flex-wrap justify-center gap-16 lg:gap-32">
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
              <h4 className="font-bold text-slate-900 text-sm">Product</h4>
              <ul className="space-y-3 text-sm text-slate-500 font-medium">
                <li>
                  <Link to="/features" className="hover:text-slate-900 transition-colors">
                    Features
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
          <p>© 2024 Phraze AI Inc. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
