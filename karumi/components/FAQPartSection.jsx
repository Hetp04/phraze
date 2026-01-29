import React, { useEffect, useRef, useState } from 'react';
import { Plus, Send } from 'lucide-react';

const faqs = [
  {
    question: 'What is Phraze?',
    answer:
      'Phraze is a collaborative workspace and living notebook for every AI conversation. It helps you highlight, annotate, and organize text from any webpage or LLM conversation.',
  },
  {
    question: 'How does Phraze work?',
    answer:
      'Phraze uses intelligent highlighting and annotation to transform AI conversations. You can add labels, codes, and notes to individual messages, making it easy to organize discussions and capture insights as they happen.',
  },
  {
    question: 'What makes Phraze different from other tools?',
    answer:
      'Unlike traditional tools that require exporting transcripts and switching platforms, Phraze keeps everything in context. It turns raw dialogue into organized, actionable material while maintaining the conversation flow.',
  },
  {
    question: 'Can I collaborate with my team?',
    answer:
      'Yes! Phraze is built for teams working with conversational data. Multiple collaborators can work in the same thread without leaving the chat, making it perfect for researchers and development teams.',
  },
  {
    question: 'How do I get started with Phraze?',
    answer:
      'Getting started is easy! Simply sign up for an account, install the Chrome extension if you want web highlighting, and start organizing your AI conversations with our intuitive annotation tools.',
  },
  {
    question: 'What types of annotations can I create?',
    answer:
      'Phraze supports custom labels, codes, and detailed notes. You can categorize conversations, highlight important insights, and create a structured knowledge base from your AI interactions.',
  },
  {
    question: 'Is my data secure with Phraze?',
    answer:
      'Absolutely. We prioritize data security and privacy. All your conversations and annotations are encrypted and stored securely. You have full control over your data and can export or delete it at any time.',
  },
  {
    question: 'Can I export my annotated conversations?',
    answer:
      'Yes! Phraze allows you to export your organized conversations in multiple formats. You can share insights with your team, create reports, or integrate the data with other tools in your workflow.',
  },
];

const FAQItem = ({ question, answer, revealActive = false, delayMs = 0 }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={`border-b border-gray-100 last:border-0 phraze-reveal-apple ${revealActive ? 'is-revealed' : ''}`}
      style={{ transitionDelay: revealActive ? `${delayMs}ms` : '0ms' }}
    >
      <button onClick={() => setIsOpen(!isOpen)} className="w-full py-4 flex items-start justify-between text-left group">
        <span className={`text-[15px] font-serif text-slate-800 transition-colors ${isOpen ? 'text-teal-700' : ''}`}>{question}</span>
        <span className={`ml-4 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}>
          <Plus className={`w-4 h-4 ${isOpen ? 'text-teal-600' : 'text-slate-400'}`} />
        </span>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-48 opacity-100 mb-4' : 'max-h-0 opacity-0'}`}>
        <p className="text-slate-500 leading-relaxed pr-8 font-light text-sm">{answer}</p>
      </div>
    </div>
  );
};

const FAQPartSection = () => {
  const sectionRef = useRef(null);
  const [revealActive, setRevealActive] = useState(false);

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

      const enterAt = vh * 0.62;
      const exitAt = vh * 0.12;
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

  return (
    <div ref={sectionRef} className="w-full pt-24 pb-32">
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
          transform: translate3d(0, 8px, 0);
          transition-property: opacity, transform;
          transition-duration: 360ms;
          transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity, transform;
        }

        .phraze-reveal-apple.is-revealed {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
      `}</style>

      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' }}>
            <div
              className={`h-px bg-gray-200/60 mb-8 phraze-reveal-apple ${revealActive ? 'is-revealed' : ''}`}
              style={{ width: '100%', transitionDelay: revealActive ? '0ms' : '0ms' }}
            />
          </div>
          <div className={`phraze-reveal-apple ${revealActive ? 'is-revealed' : ''}`} style={{ transitionDelay: revealActive ? '0ms' : '0ms' }}>
            <span className="inline-flex rounded-full p-[1px] bg-gradient-to-r from-sky-500/70 via-blue-500/70 to-sky-500/70">
              <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[#FFFEFC] text-slate-700 text-[11px] font-semibold tracking-wide">
                FAQ
              </span>
            </span>
          </div>
          <div className={`phraze-reveal-apple ${revealActive ? 'is-revealed' : ''}`} style={{ transitionDelay: revealActive ? '90ms' : '0ms' }}>
            <h2 className="mt-4 text-3xl md:text-4xl font-serif font-bold text-slate-900">Your Questions, Answered</h2>
          </div>
          <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' }}>
            <div
              className={`h-px bg-gray-200/60 mt-8 phraze-reveal-apple ${revealActive ? 'is-revealed' : ''}`}
              style={{ width: '100%', transitionDelay: revealActive ? '160ms' : '0ms' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          <div>
            <div className={`phraze-reveal-apple ${revealActive ? 'is-revealed' : ''}`} style={{ transitionDelay: revealActive ? '220ms' : '0ms' }}>
              <h3 className="text-xl font-serif font-semibold text-slate-800 mb-6">Common Questions</h3>
            </div>
            <div className="space-y-0">
              {faqs.map((faq, index) => (
                <FAQItem key={index} question={faq.question} answer={faq.answer} revealActive={revealActive} delayMs={240 + (index * 60)} />
              ))}
            </div>
          </div>

          <div
            className={`bg-white rounded-2xl p-8 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sticky top-24 phraze-reveal-apple ${revealActive ? 'is-revealed' : ''}`}
            style={{ transitionDelay: revealActive ? '460ms' : '0ms' }}
          >
            <div className="mb-8">
              <h3 className="text-xl font-serif font-semibold text-slate-800 mb-2">Need more support?</h3>
              <p className="text-slate-500 text-sm leading-relaxed">Can't find what you're looking for? Get in touch with our team.</p>
            </div>

            <form className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Your name</label>
                <input
                  type="text"
                  className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/10 placeholder:text-gray-300 transition-all"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Your email</label>
                <input
                  type="email"
                  className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/10 placeholder:text-gray-300 transition-all"
                  placeholder="john@company.com"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Subject</label>
                <input
                  type="text"
                  className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/10 placeholder:text-gray-300 transition-all"
                  placeholder="How can we help?"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Message</label>
                <textarea
                  className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/10 placeholder:text-gray-300 min-h-[120px] resize-none transition-all"
                  placeholder="Tell us more about your inquiry..."
                />
              </div>
              <button className="w-full bg-slate-900 text-white py-3.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2">
                Send Message
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQPartSection;
