import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  Sparkles,
  Route,
  PenLine,
  ChevronDown,
  X,
  Bold,
  Italic,
  Palette,
  Image as ImageIcon,
  Save,
  Plus,
  Paperclip,
  ShieldCheck,
  Copy,
  Info,
  Check,
  Users,
} from 'lucide-react';

const ChatVisual = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    let mounted = true;

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const script = async () => {
      while (mounted) {
        setMessages([]);
        setInputValue('');
        setIsTyping(false);
        await wait(1500);

        const text1 = 'Summarize the feedback on the checkout flow.';
        for (let i = 0; i <= text1.length; i++) {
          if (!mounted) return;
          setInputValue(text1.slice(0, i));
          await wait(30 + Math.random() * 30);
        }
        await wait(500);

        if (!mounted) return;
        setInputValue('');
        setMessages((prev) => [...prev, { id: 1, role: 'user', text: text1 }]);

        await wait(600);
        if (!mounted) return;
        setIsTyping(true);
        await wait(1800);

        if (!mounted) return;
        setIsTyping(false);

        const aiResponse1 =
          "I've scanned 12 sessions. Users find the credit card field confusing. 40% abandoned cart there.";
        setMessages((prev) => [...prev, { id: 2, role: 'ai', text: '' }]);

        for (let i = 0; i <= aiResponse1.length; i++) {
          if (!mounted) return;
          setMessages((prev) =>
            prev.map((m) => (m.id === 2 ? { ...m, text: aiResponse1.slice(0, i) } : m))
          );
          await wait(15);
        }

        await wait(2500);

        const text2 = "Add a tag for 'UX Issue' to those clips.";
        for (let i = 0; i <= text2.length; i++) {
          if (!mounted) return;
          setInputValue(text2.slice(0, i));
          await wait(30 + Math.random() * 30);
        }
        await wait(500);

        if (!mounted) return;
        setInputValue('');
        setMessages((prev) => [...prev, { id: 3, role: 'user', text: text2 }]);

        await wait(600);
        if (!mounted) return;
        setIsTyping(true);
        await wait(1500);

        if (!mounted) return;
        setIsTyping(false);

        const aiResponse2 = "Done. I've tagged 8 clips with 'UX Issue' and generated a report.";
        setMessages((prev) => [...prev, { id: 4, role: 'ai', text: '' }]);

        for (let i = 0; i <= aiResponse2.length; i++) {
          if (!mounted) return;
          setMessages((prev) =>
            prev.map((m) => (m.id === 4 ? { ...m, text: aiResponse2.slice(0, i) } : m))
          );
          await wait(15);
        }

        await wait(800);
        if (!mounted) return;

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === 2) {
              return {
                ...m,
                text: (
                  <span>
                    I've scanned 12 sessions.{" "}
                    <span className="relative inline-block">
                      <span className="relative z-10 text-slate-800 font-medium">
                        Users find the credit card field confusing
                      </span>
                      <span className="absolute inset-0 bg-[#fef08a] -rotate-1 origin-left scale-x-0 animate-highlight"></span>
                    </span>
                    . 40% abandoned cart there.
                  </span>
                ),
              };
            }
            return m;
          })
        );

        await wait(5000);
      }
    };

    script();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="relative group w-full flex justify-center md:justify-end">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-[440px] relative overflow-visible flex flex-col h-[420px]">
        <div className="px-5 py-4 border-b border-gray-50 bg-white z-10" />

        <div ref={scrollRef} className="flex-1 p-5 space-y-4 overflow-y-auto scroll-smooth">
          {messages.length === 0 && !isTyping && (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 opacity-50 animate-pulse">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm text-slate-400 font-medium">How can I help you today?</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                padding: '0 0.5rem',
              }}
              className="animate-[fadeIn_0.3s_ease-out]"
            >
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%', paddingLeft: 0 }}>
                <div
                  style={{
                    width: '100%',
                    fontSize: '0.8rem',
                    marginBottom: msg.role === 'user' ? '0px' : '6px',
                    fontWeight: 500,
                    color: 'rgb(85, 85, 85)',
                    textAlign: msg.role === 'user' ? 'right' : 'left',
                    paddingRight: msg.role === 'user' ? 0 : '0rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  {msg.role === 'user' ? (
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        backgroundColor: 'rgb(226, 232, 240)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        color: 'rgb(51, 65, 85)',
                        border: '1px solid rgb(203, 213, 225)',
                      }}
                    >
                      KB
                    </div>
                  ) : (
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        backgroundColor: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        color: 'white',
                        border: '1px solid #475569',
                      }}
                    >
                      P
                    </div>
                  )}
                  <span>{msg.role === 'user' ? 'kbnl' : 'phraze'}</span>
                </div>

                <div
                  className="message-bubble group"
                  style={{
                    padding: msg.role === 'user' ? '1rem' : '0rem',
                    background: msg.role === 'user' ? 'rgb(255, 255, 255)' : 'transparent',
                    borderRadius: msg.role === 'user' ? '2rem 2rem 5px' : '0.5rem',
                    color: 'rgb(10, 10, 10)',
                    display: 'inline-block',
                    width: '100%',
                    position: 'relative',
                    marginTop: msg.role === 'user' ? '0px' : '4px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.875rem',
                      lineHeight: 1.5,
                      whiteSpace: msg.role === 'user' ? 'pre-wrap' : 'normal',
                    }}
                  >
                    {msg.text}
                  </div>

                  {msg.role === 'user' ? (
                    <div
                      className="message-actions opacity-0 group-hover:opacity-100"
                      style={{
                        position: 'absolute',
                        left: '-120px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        gap: 8,
                        transition: 'opacity 0.2s',
                      }}
                    >
                      <button
                        title="Copy message"
                        style={{
                          background: 'rgba(240, 240, 240, 0.8)',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0.5rem',
                          borderRadius: '50%',
                          color: 'rgb(107, 114, 128)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 32,
                          height: 32,
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                      <button
                        title="Edit message"
                        style={{
                          background: 'rgba(240, 240, 240, 0.8)',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0.5rem',
                          borderRadius: '50%',
                          color: 'rgb(107, 114, 128)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 32,
                          height: 32,
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        title="Draw on message (click again to close)"
                        style={{
                          background: 'rgba(240, 240, 240, 0.8)',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0.5rem',
                          borderRadius: '50%',
                          color: 'rgb(107, 114, 128)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 32,
                          height: 32,
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                          <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                          <path d="M2 2l7.586 7.586"></path>
                          <circle cx="11" cy="11" r="2"></circle>
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div
                      className="ai-message-actions"
                      style={{
                        marginTop: 8,
                        display: 'flex',
                        gap: 8,
                        opacity: 1,
                        justifyContent: 'flex-start',
                      }}
                    >
                      <button
                        title="Copy message"
                        style={{
                          background: 'rgba(240, 240, 240, 0.8)',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0.5rem',
                          borderRadius: '50%',
                          color: 'rgb(107, 114, 128)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 32,
                          height: 32,
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                      <button
                        title="Draw on message (click again to close)"
                        style={{
                          background: 'rgba(240, 240, 240, 0.8)',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0.5rem',
                          borderRadius: '50%',
                          color: 'rgb(107, 114, 128)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 32,
                          height: 32,
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                          <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                          <path d="M2 2l7.586 7.586"></path>
                          <circle cx="11" cy="11" r="2"></circle>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '0 0.5rem' }} className="animate-[fadeIn_0.3s_ease-out]">
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%', paddingLeft: 0 }}>
                <div
                  style={{
                    width: '100%',
                    fontSize: '0.8rem',
                    marginBottom: '6px',
                    fontWeight: 500,
                    color: 'rgb(85, 85, 85)',
                    textAlign: 'left',
                    paddingRight: '0rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    justifyContent: 'flex-start',
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      backgroundColor: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.6rem',
                      fontWeight: 600,
                      color: 'white',
                      border: '1px solid #475569',
                    }}
                  >
                    P
                  </div>
                  <span>phraze</span>
                </div>

                <div
                  className="message-bubble"
                  style={{
                    padding: '0rem',
                    background: 'transparent',
                    borderRadius: '0.5rem',
                    color: 'rgb(10, 10, 10)',
                    display: 'inline-block',
                    width: '100%',
                    position: 'relative',
                    marginTop: '4px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', paddingTop: '2px' }}>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-50 bg-white z-10">
          <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 flex items-center justify-between">
            <div className="text-xs text-gray-600 pl-1 w-full font-medium truncate min-h-[1.2em] flex items-center">
              {inputValue}
              {!inputValue && <span className="text-gray-400 font-normal">Type a message...</span>}
              {inputValue && <span className="animate-pulse inline-block w-[1.5px] h-3.5 bg-slate-900 ml-0.5" />}
            </div>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-sm transition-colors ${
                inputValue
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-300'
              }`}
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AnnotateVisual = () => (
  <div className="relative group w-full max-w-[500px] flex items-center md:items-start justify-center md:justify-start pl-0 md:pl-10 py-10">
    <div className="absolute top-[-20px] right-[20px] md:right-[-20px] z-20 w-[260px] animate-[fadeIn_0.5s_ease-out_0.2s] transform -rotate-3 hover:rotate-0 transition-transform duration-500">
      <div className="bg-white rounded-xl shadow-[0_20px_40px_-12px_rgba(0,0,0,0.12)] border border-gray-100 p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=faces"
              className="w-8 h-8 rounded-full object-cover border border-gray-100"
              alt="Avatar"
            />
            <span className="text-xs text-slate-600 font-medium truncate max-w-[130px]">patelhet4002@gmail.com</span>
          </div>
          <button className="text-gray-300 hover:text-gray-500 transition-colors bg-gray-50 rounded-md p-0.5">
            <X className="w-3 h-3" />
          </button>
        </div>

        <div>
          <div className="w-3 h-3 rounded-full bg-red-300 shadow-sm border border-red-100"></div>
        </div>

        <div>
          <div className="text-[10px] text-gray-400 italic mb-2 font-medium">Labels</div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-[#FFF4E5] text-[#B95000] border border-[#FFDcb3] shadow-sm">
              intent: feedback
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-[#E6F8EF] text-[#008A4B] border border-[#bbf7d6] shadow-sm">
              sentiment: negative
            </span>
          </div>
        </div>

        <div className="h-px bg-gray-50 w-full"></div>

        <div className="flex items-center justify-between px-2 pt-1">
          <button className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-all shadow-sm">
            <Plus className="w-4 h-4" />
          </button>
          <button className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-all shadow-sm">
            <Paperclip className="w-4 h-4" />
          </button>
          <button className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-all shadow-sm">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <div className="bg-white rounded-xl shadow-2xl border border-gray-100 w-full max-w-[360px] overflow-hidden text-left transform md:rotate-2 hover:rotate-0 transition-transform duration-500 relative z-10 mt-6">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2 text-slate-600 font-medium text-sm">
          <PenLine className="w-4 h-4 text-gray-400" />
          <span>Add Annotations</span>
        </div>
        <div className="w-3 h-3 rounded-full bg-red-300 border border-red-100"></div>
      </div>

      <div className="p-4 space-y-5 bg-white">
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Selected text:</div>
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-[13px] text-slate-600 italic leading-relaxed text-left">
            hrase! "IH" could stand for a few things, like "I Hate" or "Ice Hockey," but without more context,
            it's hard to say for sure. Could you please provide more information...
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Labels:</div>
          <div className="relative mb-2.5">
            <div className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-slate-500 flex items-center justify-between shadow-sm hover:border-gray-300 transition-colors cursor-pointer">
              <span>Add Label</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#FFF4E5] text-[#B95000] border border-[#FFDcb3] shadow-sm">
              Intent: Feedback
              <X className="w-3 h-3 cursor-pointer opacity-60 hover:opacity-100" />
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#E6F8EF] text-[#008A4B] border border-[#bbf7d6] shadow-sm">
              Sentiment: Negative
              <X className="w-3 h-3 cursor-pointer opacity-60 hover:opacity-100" />
            </span>
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Annotation:</div>

          <div className="flex gap-2 mb-2">
            <button className="px-4 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-slate-700 border border-gray-200 shadow-inner">
              Text
            </button>
            <button className="px-4 py-1.5 rounded-md text-xs font-medium bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 shadow-sm">
              Canvas
            </button>
          </div>

          <div className="flex gap-1.5 mb-2">
            <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-slate-500 hover:bg-gray-50 transition-colors">
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-slate-500 hover:bg-gray-50 transition-colors">
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-slate-500 hover:bg-gray-50 transition-colors">
              <Palette className="w-3.5 h-3.5" />
            </button>
            <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-slate-500 hover:bg-gray-50 transition-colors">
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative">
            <textarea
              className="w-full p-3 border border-gray-200 rounded-lg text-sm min-h-[80px] text-slate-600 placeholder:text-gray-300 resize-none focus:outline-none focus:ring-1 focus:ring-gray-300 shadow-inner bg-white"
              placeholder="Share your insights, questions, or observations"
            ></textarea>
          </div>
        </div>

        <button className="w-full py-2.5 bg-white border border-gray-200 rounded-lg text-slate-600 text-sm font-medium shadow-sm hover:bg-gray-50 hover:shadow-md transition-all flex items-center justify-center gap-2 group/btn">
          <Save className="w-4 h-4 text-slate-400 group-hover/btn:text-slate-600" />
          Add Annotations
        </button>
      </div>
    </div>
  </div>
);

const CollaborateVisual = () => {
  const [animationState, setAnimationState] = useState('modal');
  const [emailInput, setEmailInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    let mounted = true;

    const runAnimation = async () => {
      while (mounted) {
        setAnimationState('modal');
        setEmailInput('');
        setShowDropdown(false);

        await new Promise((r) => setTimeout(r, 2000));

        const targetEmail = 'alex';
        for (let i = 0; i < targetEmail.length; i++) {
          if (!mounted) return;
          setEmailInput(targetEmail.slice(0, i + 1));
          await new Promise((r) => setTimeout(r, 150));
        }

        if (!mounted) return;
        setShowDropdown(true);
        await new Promise((r) => setTimeout(r, 1200));

        if (!mounted) return;
        setEmailInput('alex@design.co');
        setShowDropdown(false);
        await new Promise((r) => setTimeout(r, 800));

        if (!mounted) return;
        setAnimationState('transition');
        await new Promise((r) => setTimeout(r, 600));

        if (!mounted) return;
        setAnimationState('result');

        await new Promise((r) => setTimeout(r, 6000));
      }
    };
    runAnimation();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="relative w-full max-w-[500px] h-[360px] flex items-center justify-center">
      <div
        className={`absolute top-4 z-20 transition-all duration-500 ease-in-out ${
          animationState === 'modal'
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 -translate-y-4 pointer-events-none'
        }`}
      >
        <div className="bg-white rounded-xl shadow-2xl border border-gray-100 w-[380px] overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 text-sm">Share Project: Writing</h3>
            <X className="w-4 h-4 text-gray-300 cursor-pointer" />
          </div>

          <div className="p-5">
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Invite your team to collaborate. Secure access is granted instantly via invite code.
            </p>

            <div className="mb-4">
              <label className="text-[11px] font-bold text-slate-700 block mb-1.5">Invite Code</label>
              <div className="flex gap-2">
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-slate-600 font-mono flex items-center">
                  XW9VAJ4X
                </div>
                <button className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-slate-600 flex items-center gap-1.5 shadow-sm">
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </button>
              </div>
            </div>

            <div className="w-full h-px bg-gray-50 my-4" />

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1.5">Share via email</label>
              <div className="relative flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={emailInput}
                    readOnly
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="colleague@company.com"
                  />

                  {showDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                      {[
                        {
                          name: 'Alex Rivera',
                          email: 'alex@design.co',
                          img: 'https://i.pravatar.cc/100?img=53',
                        },
                        {
                          name: 'Alexandra B.',
                          email: 'alex.b@corp.io',
                          img: 'https://i.pravatar.cc/100?img=44',
                        },
                      ].map((user, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-teal-50 cursor-pointer group transition-colors first:bg-gray-50"
                        >
                          <img src={user.img} className="w-6 h-6 rounded-full" alt="" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-slate-700 group-hover:text-teal-800">
                              {user.name}
                            </div>
                            <div className="text-[10px] text-gray-400 truncate">{user.email}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors shadow-sm ${
                    emailInput.includes('@')
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  Invite
                </button>
              </div>
            </div>
          </div>

          <div className="bg-gray-50/50 p-4 border-t border-gray-50 mt-1">
            <div className="flex gap-3 items-start p-3 bg-white border border-gray-100 rounded-lg">
              <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-500 leading-snug">
                <span className="font-semibold text-slate-700">How it works:</span> Share the invite code with your
                team. They can enter it in the "Shared Projects" tab to join.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`relative w-full h-full transition-all duration-700 ease-out ${
          animationState === 'result' ? 'opacity-100 scale-100 blur-0' : 'opacity-0 scale-95 blur-sm'
        }`}
      >
        <div className="absolute left-4 top-10 md:left-2 md:top-10 bg-white rounded-2xl shadow-xl border border-gray-100 p-6 w-[280px] z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              Team Access
            </div>
            <div className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-medium rounded-full border border-emerald-100 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </div>
          </div>

          <div className="flex items-center -space-x-3 mb-6 pl-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-full border-[3px] border-white bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm"
              >
                <img
                  src={`https://i.pravatar.cc/100?img=${i + 10}`}
                  alt={`User ${i}`}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
            ))}
            <div className="w-10 h-10 rounded-full border-[3px] border-white bg-teal-100 flex items-center justify-center shadow-sm relative z-10 animate-in zoom-in duration-500">
              <img src="https://i.pravatar.cc/100?img=53" className="w-full h-full rounded-full object-cover" alt="New User" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 flex gap-3 items-start border border-gray-100 shadow-sm">
            <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
              S
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-semibold text-slate-900">Sarah M.</span>
                <span className="text-[9px] text-gray-400">2m ago</span>
              </div>
              <div className="text-[11px] text-gray-500 leading-snug">
                I've tagged all the payment failures. Can someone review the "critical" ones?
              </div>
            </div>
          </div>
        </div>

        <div className="absolute right-0 top-0 md:-right-6 bg-white rounded-xl shadow-[0_20px_40px_-12px_rgba(0,0,0,0.15)] border border-gray-100 w-[240px] p-4 z-20 transform rotate-2">
          <div className="flex items-center justify-between mb-4 border-b border-gray-50 pb-3">
            <span className="text-xs font-semibold text-slate-700">Manage Access</span>
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                  You
                </div>
                <span className="text-[11px] font-medium text-slate-600">Admin</span>
              </div>
              <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                Owner
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="https://i.pravatar.cc/100?img=12" className="w-6 h-6 rounded-full" alt="Sarah" />
                <span className="text-[11px] font-medium text-slate-600">Sarah M.</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-medium text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100 shadow-sm">
                Editor <ChevronDown className="w-2 h-2" />
              </div>
            </div>

            <div className="flex items-center justify-between animate-in slide-in-from-left-2 duration-500 fade-in fill-mode-forwards">
              <div className="flex items-center gap-2">
                <img
                  src="https://i.pravatar.cc/100?img=53"
                  className="w-6 h-6 rounded-full ring-2 ring-emerald-100"
                  alt="Alex"
                />
                <span className="text-[11px] font-medium text-slate-800">Alex R.</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-white px-1.5 py-0.5 rounded border border-gray-200 shadow-sm">
                Viewer <ChevronDown className="w-2 h-2" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StepSection = ({ number, title, description, visual, reversed = false, delayMs = 0, revealCycle = 0 }) => {
  const stepRef = useRef(null);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    setIsRevealed(false);
  }, [revealCycle]);

  useEffect(() => {
    const el = stepRef.current;
    if (!el) return;

    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mediaQuery?.matches) {
      setIsRevealed(true);
      return;
    }

    if (!('IntersectionObserver' in window)) {
      setIsRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setIsRevealed(Boolean(entry.isIntersecting));
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -18% 0px'
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [revealCycle]);

  return (
    <div
      ref={stepRef}
      className={`flex flex-col ${reversed ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-12 md:gap-24 mb-48 last:mb-0 phraze-bento-reveal ${isRevealed ? 'is-revealed' : ''}`}
      style={{ transitionDelay: isRevealed ? `${delayMs}ms` : '0ms' }}
    >
      <div className={`flex-1 text-center md:text-left ${reversed ? '' : 'md:-ml-6'}`}>
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 text-slate-900 font-semibold text-lg mb-6 shadow-sm" style={{ fontFamily: '"Glacial Indifference", sans-serif' }}>
          {number}
        </div>
        <h3 className="text-3xl font-bold text-slate-900 mb-4" style={{ fontFamily: '"Glacial Indifference", sans-serif' }}>{title}</h3>
        <p className="text-slate-500 text-lg leading-relaxed font-light" style={{ fontFamily: '"Glacial Indifference", sans-serif' }}>{description}</p>
      </div>

      <div className="flex-1 w-full flex justify-center md:justify-end select-none">{visual}</div>
    </div>
  );
};

export default function HowItWorksHero() {
  const sectionRef = useRef(null);
  const [revealCycle, setRevealCycle] = useState(0);
  const revealWasOutRef = useRef(true);
  const [headerRevealActive, setHeaderRevealActive] = useState(false);

  useEffect(() => {
    const sectionEl = sectionRef.current;
    if (!sectionEl) return;

    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mediaQuery?.matches) {
      setRevealCycle(1);
      return;
    }

    if (!('IntersectionObserver' in window)) {
      setRevealCycle(1);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting) {
          if (revealWasOutRef.current) {
            revealWasOutRef.current = false;
            setRevealCycle((c) => c + 1);
          }
          setHeaderRevealActive(true);
        } else {
          revealWasOutRef.current = true;
          setHeaderRevealActive(false);
        }
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -10% 0px'
      }
    );

    observer.observe(sectionEl);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full flex flex-col items-center relative overflow-hidden bg-[#FFFDF8]">
      <style>{`
        @keyframes highlight {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes draw {
          to { stroke-dashoffset: 0; }
        }
        .animate-highlight {
          animation: highlight 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        .animate-draw-line {
          stroke-dasharray: 2500;
          stroke-dashoffset: 2500;
          animation: draw 2.5s ease-out forwards;
        }
        .animate-draw-arrow {
            animation: fadeIn 0.4s ease-out forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .phraze-bento-reveal {
            opacity: 1 !important;
            transform: none !important;
            transition: none !important;
          }
        }

        .phraze-bento-reveal {
          opacity: 0;
          transform: translate3d(0, 12px, 0);
          transition-property: opacity, transform;
          transition-duration: 480ms;
          transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity, transform;
        }

        .phraze-bento-reveal.is-revealed {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
      `}</style>

      <div className="w-full bg-[#FFFDF8] py-24 relative z-10">
        <div ref={sectionRef} className="max-w-6xl mx-auto px-6">
          <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' }} className="relative mb-16">
            <div
              className={`pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-[1150px] transition-opacity duration-300 ${
                headerRevealActive ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(34,211,238,0.02) 0%, rgba(34,211,238,0.05) 36%, rgba(34,211,238,0.10) 62%, rgba(34,211,238,0.14) 100%)' }} />
              <div className="absolute left-0 top-0 bottom-0 w-px bg-[rgba(148,163,184,0.28)]" />
              <div className="absolute right-0 top-0 bottom-0 w-px bg-[rgba(148,163,184,0.28)]" />
            </div>
            <div className="max-w-6xl mx-auto px-6">
              <div className="max-w-3xl mx-auto text-center relative">
                <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' }}>
                  <div
                    className={`h-px bg-gray-200/60 mb-8 phraze-bento-reveal ${headerRevealActive ? 'is-revealed' : ''}`}
                    style={{ width: '100%', transitionDelay: headerRevealActive ? '0ms' : '0ms' }}
                  />
                </div>
                <div className={`phraze-bento-reveal ${headerRevealActive ? 'is-revealed' : ''}`} style={{ transitionDelay: headerRevealActive ? '0ms' : '0ms' }}>
                  <span className="inline-flex rounded-full p-[1px] bg-gradient-to-r from-sky-500/70 via-blue-500/70 to-sky-500/70">
                    <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-white text-slate-700 text-[11px] font-semibold tracking-wide">
                      <Route className="w-3.5 h-3.5 text-slate-500" />
                      How it works
                    </span>
                  </span>
                </div>
                <div className={`phraze-bento-reveal ${headerRevealActive ? 'is-revealed' : ''}`} style={{ transitionDelay: headerRevealActive ? '90ms' : '0ms' }}>
                  <h2 className="mt-4 text-3xl md:text-4xl font-bold text-slate-900" style={{ fontFamily: '"Glacial Indifference", sans-serif' }}>From chat to shared insights.</h2>
                </div>
                <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' }}>
                  <div
                    className={`h-px bg-gray-200/60 mt-8 phraze-bento-reveal ${headerRevealActive ? 'is-revealed' : ''}`}
                    style={{ width: '100%', transitionDelay: headerRevealActive ? '160ms' : '0ms' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <StepSection
            number="01"
            title="Chat with Phraze AI"
            description="Experience natural, context-aware conversations. Ask complex questions, generate content, and explore ideas with an AI that understands your goals."
            visual={<ChatVisual />}
            delayMs={0}
            revealCycle={revealCycle}
          />

          <StepSection
            number="02"
            title="Annotate Your Insights"
            description="Don't let good ideas get lost in the scroll. Highlight key moments, attach custom labels, and add notes to structure your qualitative data instantly."
            visual={<AnnotateVisual />}
            reversed
            delayMs={120}
            revealCycle={revealCycle}
          />

          <StepSection
            number="03"
            title="Collaborate & Share"
            description="Turn individual chats into team knowledge. Invite colleagues to view, comment, assign role-based permissions (Owner, Editor, Viewer), and build upon your annotated conversations in a shared workspace."
            visual={<CollaborateVisual />}
            delayMs={240}
            revealCycle={revealCycle}
          />
        </div>
      </div>
    </div>
  );
}
