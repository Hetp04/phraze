import React, { useEffect, useRef, useState } from 'react';
import { Users, Highlighter, LayoutGrid, Lightbulb } from 'lucide-react';

function FeatureCard({ title, description, Icon, active, onClick }) {
  const [isHovered, setIsHovered] = useState(false);

  const bg = active ? '#ffffff' : (isHovered ? '#f2f2f2' : '#f7f7f7');
  const borderColor = active ? '#e5e7eb' : (isHovered ? '#dcdcdb' : '#e5e5e5');

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ backgroundColor: bg, borderColor }}
      className={`pt-5 px-4 pb-5 rounded-xl transition-all duration-300 cursor-pointer text-left h-full flex flex-col gap-1.5 border relative overflow-visible ${
        active ? 'shadow-sm' : ''
      }`}
    >
      {Icon ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 20,
            transform: 'translate(0, -100%)',
            width: 52,
            height: 32,
            borderTopLeftRadius: 9999,
            borderTopRightRadius: 9999,
            backgroundColor: bg,
            border: `1px solid ${borderColor}`,
            borderBottom: '0px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon className="w-[18px] h-[18px] text-slate-400" style={{ marginTop: 4 }} />
        </div>
      ) : null}

      <h3
        className="text-[15px] font-semibold transition-colors text-slate-900"
        style={{ fontFamily: '"Times New Roman", Times, serif' }}
      >
        <span>{title}</span>
      </h3>
      <p
        className="text-[14px] leading-[1.4] transition-colors text-slate-700"
        style={{ fontFamily: '"Times New Roman", Times, serif' }}
      >
        {description}
      </p>
    </div>
  );
}

function NotionDemo() {
  const [activeTab, setActiveTab] = useState(0);
  const activeTabRef = useRef(0);
  const sectionRef = useRef(null);
  const stickyRef = useRef(null);
  const [stickyTop, setStickyTop] = useState(140);
  const [revealActive, setRevealActive] = useState(false);
  const programmaticScrollRef = useRef(false);
  const programmaticTargetYRef = useRef(null);
  const programmaticUntilRef = useRef(0);
  const programmaticTabRef = useRef(null);

  const tabs = [
    {
      title: 'Real-Time Collaboration',
      desc: 'Collaborate on chat threads, track updates in real time, and maintain coordinated contributions.',
      Icon: Users,
    },
    {
      title: 'Smart Highlighting',
      desc: 'Easily highlight, label, and annotate messages to streamline conversation analysis.',
      Icon: Highlighter,
    },
    {
      title: 'Unified Workspace',
      desc: 'Keep all annotations, notes, and discussions organized in one collaborative space.',
      Icon: LayoutGrid,
    },
    {
      title: 'Shared Insights',
      desc: 'Compare perspectives, align decisions, and capture key takeaways together.',
      Icon: Lightbulb,
    },
  ];

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const sectionEl = sectionRef.current;
    if (!sectionEl) return;

    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mediaQuery?.matches) {
      setRevealActive(true);
      return;
    }

    let raf = 0;

    const compute = () => {
      raf = 0;
      const rect = sectionEl.getBoundingClientRect();
      const vh = window.innerHeight || 0;

      // Start reveal a bit later so the user can actually see the animation.
      // Keep it visible longer when scrolling past so the big panel doesn't disappear too early.
      const enterAt = vh * 0.62;
      const exitAt = vh * 0.15;

      const shouldBeActive = rect.top < enterAt && rect.bottom > exitAt;
      setRevealActive(shouldBeActive);
    };

    const onScrollOrResize = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(compute);
    };

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    compute();

    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const navbarMinOffset = 96;

    const recalcStickyTop = () => {
      const el = stickyRef.current;
      if (!el) {
        setStickyTop(navbarMinOffset);
        return;
      }

      const rect = el.getBoundingClientRect();
      const blockH = rect.height || 0;
      const centered = (window.innerHeight - blockH) / 2;
      const visualOffset = 44;
      const maxTop = navbarMinOffset + 84;
      const nextTop = Math.min(
        maxTop,
        Math.max(navbarMinOffset, Math.floor(centered) + visualOffset)
      );
      setStickyTop(nextTop);
    };

    recalcStickyTop();
    window.addEventListener('resize', recalcStickyTop);
    return () => window.removeEventListener('resize', recalcStickyTop);
  }, []);

  useEffect(() => {
    let raf = 0;

    const updateFromScroll = () => {
      raf = 0;
      const sectionEl = sectionRef.current;
      if (!sectionEl) return;

      if (programmaticScrollRef.current) {
        const targetY = programmaticTargetYRef.current;
        const until = programmaticUntilRef.current;
        const locked = programmaticTabRef.current;

        if (typeof locked === 'number' && locked !== activeTabRef.current) {
          setActiveTab(locked);
          return;
        }

        const now = Date.now();
        const reached = typeof targetY === 'number' ? Math.abs(window.scrollY - targetY) < 2 : false;
        const expired = now > until;

        if (reached || expired) {
          programmaticScrollRef.current = false;
          programmaticTargetYRef.current = null;
          programmaticTabRef.current = null;
        } else {
          return;
        }
      }

      const start = sectionEl.offsetTop;
      const end = start + sectionEl.offsetHeight - window.innerHeight;
      const denom = Math.max(1, end - start);

      const tRaw = (window.scrollY - start) / denom;
      const t = Math.min(0.9999, Math.max(0, tRaw));
      const idx = Math.min(tabs.length - 1, Math.max(0, Math.floor(t * tabs.length)));

      if (idx !== activeTabRef.current) setActiveTab(idx);
    };

    const onScrollOrResize = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(updateFromScroll);
    };

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    onScrollOrResize();

    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [tabs.length]);

  return (
    <section ref={sectionRef} className="w-full py-12 relative z-20">
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .phraze-reveal-apple {
            opacity: 1 !important;
            transform: none !important;
            transition: none !important;
          }
        }

        .phraze-reveal-apple {
          opacity: 0;
          transform: translate3d(0, 10px, 0);
          transition-property: opacity, transform;
          transition-duration: 420ms;
          transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity, transform;
        }

.phraze-reveal-apple.is-revealed {
opacity: 1;
transform: translate3d(0, 0, 0);
}
`}</style>
<div className="max-w-[1200px] mx-auto px-6">
<div className="relative">
<div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' }} className="relative mb-28">
<div
className={`pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-[1150px] transition-opacity duration-300 ${
revealActive ? 'opacity-100' : 'opacity-0'
}`}
>
<div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(34,211,238,0.02) 0%, rgba(34,211,238,0.05) 36%, rgba(34,211,238,0.10) 62%, rgba(34,211,238,0.14) 100%)' }} />
<div className="absolute left-0 top-0 bottom-0 w-px bg-[rgba(148,163,184,0.28)]" />
<div className="absolute right-0 top-0 bottom-0 w-px bg-[rgba(148,163,184,0.28)]" />
</div>

<div className="max-w-[1200px] mx-auto px-6">
<div className="max-w-3xl mx-auto text-center relative">
<div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' }}>
<div
className={`h-px bg-gray-200/60 mb-8 phraze-reveal-apple ${revealActive ? 'is-revealed' : ''}`}
style={{ width: '100%', transitionDelay: revealActive ? '0ms' : '0ms' }}
/>
</div>
<div className={`phraze-reveal-apple ${revealActive ? 'is-revealed' : ''}`} style={{ transitionDelay: revealActive ? '0ms' : '0ms' }}>
<span className="inline-flex rounded-full p-[1px] bg-gradient-to-r from-sky-500/70 via-blue-500/70 to-sky-500/70">
<span className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-white text-slate-700 text-[11px] font-semibold tracking-wide">
<LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
Workspace
</span>
</span>
</div>
<div className={`phraze-reveal-apple ${revealActive ? 'is-revealed' : ''}`} style={{ transitionDelay: revealActive ? '90ms' : '0ms' }}>
<h2 className="mt-4 text-3xl md:text-4xl font-serif font-bold text-slate-900">Collaborate in real time.</h2>
</div>
<div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' }}>
<div
className={`h-px bg-gray-200/60 mt-8 phraze-reveal-apple ${revealActive ? 'is-revealed' : ''}`}
style={{ width: '100%', transitionDelay: revealActive ? '160ms' : '0ms' }}
/>
</div>
</div>
</div>
</div>
          <div ref={stickyRef} className="z-10" style={{ position: 'sticky', top: stickyTop }}>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {tabs.map((tab, idx) => (
                <div
                  key={idx}
                  className={`phraze-reveal-apple ${revealActive ? 'is-revealed' : ''}`}
                  style={{ transitionDelay: revealActive ? `${idx * 70}ms` : '0ms' }}
                >
                  <FeatureCard
                    title={tab.title}
                    description={tab.desc}
                    Icon={tab.Icon}
                    active={activeTab === idx}
                    onClick={() => {
                      setActiveTab(idx);
                      const sectionEl = sectionRef.current;
                      if (!sectionEl) return;
                      const start = sectionEl.offsetTop;
                      const end = start + sectionEl.offsetHeight - window.innerHeight;
                      const denom = Math.max(1, end - start);
                      const target = start + (idx + 0.5) * (denom / tabs.length);

                      programmaticScrollRef.current = true;
                      programmaticTargetYRef.current = target;
                      programmaticTabRef.current = idx;
                      programmaticUntilRef.current = Date.now() + 900;

                      window.scrollTo({ top: target, behavior: 'smooth' });
                    }}
                  />
                </div>
              ))}
            </div>

            <div
              className={`w-full bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-gray-200 overflow-hidden flex flex-col h-[640px] relative transition-all duration-500 phraze-reveal-apple ${revealActive ? 'is-revealed' : ''}`}
              style={{ transitionDelay: revealActive ? '260ms' : '0ms' }}
            >
              <div className="flex-1 bg-white flex items-center justify-center p-12 overflow-hidden">
                <style>{`
                  @keyframes smoothFadeSlide {
                    0% {
                      opacity: 0;
                      transform: translateY(24px) scale(0.95);
                      filter: blur(8px);
                    }
                    100% {
                      opacity: 1;
                      transform: translateY(0) scale(1);
                      filter: blur(0);
                    }
                  }
                `}</style>

                <div
                  key={activeTab}
                  className="text-[240px] font-serif text-gray-50 font-bold select-none tracking-tighter animate-[smoothFadeSlide_0.6s_cubic-bezier(0.16,1,0.3,1)_forwards]"
                >
                  {activeTab + 1}
                </div>
              </div>
            </div>
          </div>

          <div style={{ height: 120 }} />
          {tabs.map((_, idx) => (
            <div
              key={idx}
              data-idx={idx}
              style={{ height: '90vh' }}
            />
          ))}
          <div style={{ height: 120 }} />
        </div>
      </div>
    </section>
  );
}

export default function WorkspaceHero() {
  return (
    <div className="w-full flex flex-col items-center justify-center">
      <NotionDemo />
    </div>
  );
}
