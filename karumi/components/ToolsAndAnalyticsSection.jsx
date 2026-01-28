import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Highlighter, MessageSquare, Tag, Users } from 'lucide-react';
import SecondPageChatDemo from './SecondPageChatDemo';

const IconChevronDown = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const ContactChatBubble = ({ side = 'left', children }) => {
  const isCurrentUser = side === 'right';
  return (
    <div style={{ display: 'flex', justifyContent: isCurrentUser ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          padding: '8px 14px',
          borderRadius: '12px',
          backgroundColor: isCurrentUser ? '#E1EEFF' : '#f3f4f6',
          color: isCurrentUser ? '#0f172a' : '#111827',
          fontSize: '14px',
          lineHeight: '1.4',
          wordWrap: 'break-word',
          display: 'inline-block',
          position: 'relative',
          maxWidth: '78%',
          transition: 'all 0.2s ease',
        }}
      >
        {children}
      </div>
    </div>
  );
};

const ContactBento = () => {
  const [mode, setMode] = useState('list');
  const [playKey, setPlayKey] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [activeContactIndex, setActiveContactIndex] = useState(0);
  const [listSelected, setListSelected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingSide, setTypingSide] = useState('left');
  const [typingMessageIndex, setTypingMessageIndex] = useState(null);
  const [typingText, setTypingText] = useState('');

  const chatScrollRef = useRef(null);

  const presenceDotStyle = {
    position: 'absolute',
    bottom: '-2px',
    right: '0px',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#22c55e',
    border: '2px solid white',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
  };

  const conversations = [
    {
      contact: { name: 'Alex', role: 'Editor', avatarSrc: '/alex.png' },
      messages: [
        { id: 'a1', sender: 'Alex', time: '10:23 AM', side: 'right', kind: 'text', text: 'Did you see the latest transformer updates? They look really promising.' },
        { id: 'a2', sender: 'Priya', time: '10:25 AM', side: 'left', kind: 'text', text: 'Yes, I skimmed it earlier. The attention improvements are super interesting.' },
        { id: 'a3', sender: 'Alex', time: '10:27 AM', side: 'right', kind: 'text', text: 'Here is the highlight I pulled from it.' },
        {
          id: 'a4',
          sender: 'Alex',
          time: '10:27 AM',
          side: 'right',
          kind: 'highlight',
          title: 'Attached highlight',
          quote: '"The transformer model achieves state-of-the-art performance by using self-attention mechanisms to process entire sequences simultaneously"',
        },
        { id: 'a5', sender: 'Priya', time: '10:28 AM', side: 'left', kind: 'text', text: 'Nice find. The parallel processing benefit is huge. This is great context to keep.' },
      ],
    },
    {
      contact: { name: 'Priya', role: 'Editor', avatarSrc: '/priya.png' },
      messages: [
        { id: 'p1', sender: 'Priya', time: '10:59 AM', side: 'right', kind: 'text', text: 'Quick update. I tagged the key claims and added labels.' },
        { id: 'p2', sender: 'Alex', time: '11:01 AM', side: 'left', kind: 'text', text: 'Awesome. Can you send the highlight excerpt you used?' },
        {
          id: 'p3',
          sender: 'Priya',
          time: '11:02 AM',
          side: 'right',
          kind: 'highlight',
          title: 'Attached highlight',
          quote: '"Attention optimizations reduce compute while improving throughput on long sequences."',
        },
        { id: 'p4', sender: 'Alex', time: '11:03 AM', side: 'left', kind: 'text', text: 'Perfect. Let’s include that in the summary.' },
      ],
    },
  ];

  const active = conversations[activeContactIndex % conversations.length];
  const messages = active?.messages || [];
  const activeContact = active?.contact || { name: 'Alex', role: 'Editor', avatarSrc: '/alex.png' };

  useEffect(() => {
    if (mode !== 'chat') return;

    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mediaQuery?.matches) {
      setVisibleCount(messages.length);
      return;
    }

    setVisibleCount(0);
    setIsTyping(false);
    setTypingMessageIndex(null);
    setTypingText('');
    let timeoutIds = [];
    let rafIds = [];
    const typingDelayMs = 1450;
    const betweenDelayMs = 460;
    const charMs = 36;

    let t = 220;
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (!m) continue;

      const isOutgoingText = m.side === 'right' && m.kind === 'text' && typeof m.text === 'string';

      t += betweenDelayMs;
      const startId = window.setTimeout(() => {
        if (isOutgoingText) {
          setIsTyping(false);
          setTypingSide('right');
          setTypingMessageIndex(i);
          setTypingText('');
          setVisibleCount((prev) => Math.max(prev, i + 1));

          const full = m.text || '';
          const startAt = performance.now();
          const tick = () => {
            const elapsed = performance.now() - startAt;
            const nextLen = Math.min(full.length, Math.floor(elapsed / charMs));
            setTypingText(full.slice(0, nextLen));
            if (nextLen >= full.length) return;
            const rafId = window.requestAnimationFrame(tick);
            rafIds.push(rafId);
          };
          const rafId = window.requestAnimationFrame(tick);
          rafIds.push(rafId);
        } else {
          setTypingMessageIndex(null);
          setTypingText('');
          setTypingSide(m.side);
          setIsTyping(m.side === 'left');
        }
      }, t);
      timeoutIds.push(startId);

      const revealDelay = isOutgoingText
        ? Math.min(2600, Math.max(1200, (m.text?.length ?? 0) * charMs + 520))
        : typingDelayMs + 260;
      t += revealDelay;
      const revealId = window.setTimeout(() => {
        setIsTyping(false);
        setTypingMessageIndex(null);
        setTypingText('');
        if (!isOutgoingText) {
          setVisibleCount((prev) => Math.max(prev, i + 1));
        }
      }, t);
      timeoutIds.push(revealId);
    }

    return () => {
      timeoutIds.forEach((id) => window.clearTimeout(id));
      rafIds.forEach((id) => window.cancelAnimationFrame(id));
      timeoutIds = [];
      rafIds = [];
    };
  }, [mode, playKey, activeContactIndex]);

  useEffect(() => {
    if (mode !== 'list') return;

    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const selectDelay = mediaQuery?.matches ? 0 : 420;
    const openDelay = mediaQuery?.matches ? 0 : 1400;

    setListSelected(false);
    const id1 = window.setTimeout(() => {
      setListSelected(true);
    }, selectDelay);

    const id2 = window.setTimeout(() => {
      setMode('chat');
      setPlayKey((k) => k + 1);
    }, openDelay);

    return () => {
      window.clearTimeout(id1);
      window.clearTimeout(id2);
    };
  }, [mode, activeContactIndex]);

  useEffect(() => {
    if (mode !== 'chat') return;
    if (visibleCount < messages.length) return;

    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const holdDelay = mediaQuery?.matches ? 700 : 2000;

    const id = window.setTimeout(() => {
      setMode('list');
      setActiveContactIndex((idx) => (idx + 1) % conversations.length);
    }, holdDelay);

    return () => window.clearTimeout(id);
  }, [mode, visibleCount]);

  useEffect(() => {
    if (mode !== 'chat') return;
    const el = chatScrollRef.current;
    if (!el) return;

    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const behavior = mediaQuery?.matches ? 'auto' : 'smooth';

    const raf = window.requestAnimationFrame(() => {
      try {
        el.scrollTo({ top: el.scrollHeight, behavior });
      } catch (e) {
        el.scrollTop = el.scrollHeight;
      }
    });

    return () => window.cancelAnimationFrame(raf);
  }, [mode, visibleCount, isTyping, typingText, typingMessageIndex]);

  return (
    <div className="w-full h-full">
      <style>{`
        @keyframes phrazeContactFadeUp {
          0% { opacity: 0; transform: translate3d(0, 8px, 0); }
          100% { opacity: 1; transform: translate3d(0, 0, 0); }
        }

        @keyframes phrazeTypingDot {
          0%, 80%, 100% { transform: translate3d(0, 0, 0); opacity: 0.55; }
          40% { transform: translate3d(0, -2px, 0); opacity: 1; }
        }
      `}</style>
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '10px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {mode === 'list' ? (
            <motion.div
              key="contact-list"
              style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
              initial={{ x: 0, opacity: 1 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -42, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
            <div
              style={{
                width: '100%',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                marginBottom: '0px',
                padding: '0px 4px',
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontWeight: '600',
                  color: '#1f2937',
                }}
              >
                Choose Contact
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', width: '100%', padding: '0 4px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px',
                  border: 'none',
                  background: listSelected && activeContactIndex % conversations.length === 0 ? '#f5f5f5' : '#ffffff',
                  borderTop: 'solid 1px #F7F7F8',
                  width: '100%',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                  transition: 'background-color 240ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      backgroundColor: '#e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                      position: 'relative',
                    }}
                  >
                    <img
                      src="/alex.png"
                      alt="Alex"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                  <div
                    style={{
                      ...presenceDotStyle,
                      width: '12px',
                      height: '12px',
                      border: '2px solid white',
                      bottom: '-3px',
                      right: '-1px',
                    }}
                    title="Active"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '500', fontSize: '14px', color: '#1f2937', marginBottom: '4px' }}>Alex</div>
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}
                  >
                    Check out this highlight I found:
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#9ca3af', whiteSpace: 'nowrap' }}>10:27 AM</div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px',
                  border: 'none',
                  background: listSelected && activeContactIndex % conversations.length === 1 ? '#f5f5f5' : '#ffffff',
                  borderTop: 'solid 1px #F7F7F8',
                  width: '100%',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                  transition: 'background-color 240ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img
                    src="/priya.png"
                    alt="Priya"
                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
                  />
                  <div
                    style={{
                      ...presenceDotStyle,
                      width: '12px',
                      height: '12px',
                      border: '2px solid white',
                      bottom: '-3px',
                      right: '-1px',
                    }}
                    title="Active"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '500', fontSize: '14px', color: '#1f2937', marginBottom: '4px' }}>Priya</div>
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}
                  >
                    Yes! The attention mechanism optimizations are fascinating
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#9ca3af', whiteSpace: 'nowrap' }}>10:25 AM</div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px',
                  border: 'none',
                  background: '#ffffff',
                  borderTop: 'solid 1px #F7F7F8',
                  width: '100%',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                }}
              >
                <img
                  src="/maya.png"
                  alt="Maya"
                  style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '500', fontSize: '14px', color: '#1f2937', marginBottom: '4px' }}>Maya</div>
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}
                  >
                    Have you reviewed the latest changes?
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#9ca3af', whiteSpace: 'nowrap' }}>10:15 AM</div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px',
                  border: 'none',
                  background: '#ffffff',
                  borderTop: 'solid 1px #F7F7F8',
                  width: '100%',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1f2937',
                    flexShrink: 0,
                  }}
                >
                  J
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '500', fontSize: '14px', color: '#1f2937', marginBottom: '4px' }}>James</div>
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}
                  >
                    Great progress on the project!
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#9ca3af', whiteSpace: 'nowrap' }}>9:52 AM</div>
              </div>
            </div>
            </motion.div>
          ) : (
            <motion.div
              key="contact-chat"
              style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
              initial={{ x: 42, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 42, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
            <div
              style={{
                width: '100%',
                padding: '10px 12px',
                borderBottom: '1px solid rgba(226, 232, 240, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '12px',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    border: '1px solid #e5e7eb',
                    boxSizing: 'border-box',
                  }}
                >
                  <img
                    src={activeContact.avatarSrc}
                    alt={activeContact.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
                <div
                  style={{
                    ...presenceDotStyle,
                    width: '14px',
                    height: '14px',
                    border: '2px solid white',
                    bottom: '-3px',
                    right: '-1px',
                  }}
                  title="Active"
                />
              </div>

              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#111827',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: '1.2',
                  }}
                >
                  {activeContact.name}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px', lineHeight: '1.2' }}>{activeContact.role}</div>
              </div>
            </div>

            <div ref={chatScrollRef} style={{ width: '100%', flex: 1, overflowY: 'auto', padding: '12px 12px', boxSizing: 'border-box' }}>
              {messages.slice(0, visibleCount).map((m, index) => (
                <div
                  key={m.id}
                  className="animate-in"
                  style={{
                    animation: 'phrazeContactFadeUp 520ms cubic-bezier(0.16, 1, 0.3, 1) both',
                    marginBottom: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#6b7280',
                      marginBottom: '8px',
                      padding: 0,
                      textAlign: m.side === 'right' ? 'right' : 'left',
                      fontVariantNumeric: 'tabular-nums',
                      width: '100%',
                    }}
                  >
                    {m.time}
                  </div>
                  <ContactChatBubble side={m.side}>
                    {m.kind === 'highlight' ? (
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px' }}>{m.title}</div>
                        <div
                          style={{
                            padding: '10px 12px',
                            borderRadius: '10px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderLeft: m.side === 'right' ? '3px solid rgba(37, 99, 235, 0.55)' : '3px solid rgba(17, 24, 39, 0.18)',
                            color: '#0f172a',
                            fontSize: '12px',
                            lineHeight: '1.35',
                          }}
                        >
                          {m.quote}
                        </div>
                      </div>
                    ) : (
                      m.side === 'right' && m.kind === 'text' && typingMessageIndex === index ? (
                        <span style={{ whiteSpace: 'pre-line' }}>{typingText}</span>
                      ) : (
                        m.text
                      )
                    )}
                  </ContactChatBubble>
                </div>
              ))}

              {isTyping ? (
                <div
                  style={{
                    marginBottom: '12px',
                    animation: 'phrazeContactFadeUp 360ms cubic-bezier(0.16, 1, 0.3, 1) both',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: typingSide === 'right' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div style={{ width: '100%', display: 'flex', justifyContent: typingSide === 'right' ? 'flex-end' : 'flex-start' }}>
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: '16px',
                        backgroundColor: typingSide === 'right' ? '#E1EEFF' : '#f3f4f6',
                        color: typingSide === 'right' ? '#0f172a' : '#111827',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        maxWidth: '78%',
                        minWidth: '54px',
                        boxSizing: 'border-box',
                      }}
                    >
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: typingSide === 'right' ? 'rgba(15,23,42,0.65)' : '#9ca3af', animation: 'phrazeTypingDot 1200ms ease-in-out infinite' }} />
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: typingSide === 'right' ? 'rgba(15,23,42,0.65)' : '#9ca3af', animation: 'phrazeTypingDot 1200ms ease-in-out infinite', animationDelay: '160ms' }} />
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: typingSide === 'right' ? 'rgba(15,23,42,0.65)' : '#9ca3af', animation: 'phrazeTypingDot 1200ms ease-in-out infinite', animationDelay: '320ms' }} />
                    </div>
                  </div>
                </div>
              ) : null}

            </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const IconBarChart3 = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
);

const IconWrench = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14.7 6.3a5 5 0 0 0-6.4 6.4l-6.1 6.1a2 2 0 0 0 2.8 2.8l6.1-6.1a5 5 0 0 0 6.4-6.4l-2 2-3-3 2-2Z" />
  </svg>
);

const IconTag = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m17.524 17.524l-2.722 2.723a2.567 2.567 0 0 1-3.634 0L4.13 13.209A3.852 3.852 0 0 1 3 10.487V5.568A2.568 2.568 0 0 1 5.568 3h4.919c1.021 0 2 .407 2.722 1.13l7.038 7.038a2.567 2.567 0 0 1 0 3.634z" />
    <path d="M9.126 11.694a2.568 2.568 0 1 0 0-5.137a2.568 2.568 0 0 0 0 5.137" />
  </svg>
);

const IconFileText = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
    <path d="M10 9H8" />
  </svg>
);

const IconUsers = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <path d="M9 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8Z" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconSearch = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m21 21-4.3-4.3" />
    <circle cx="11" cy="11" r="7" />
  </svg>
);

const ToolItem = ({ icon: Icon, label, subLabel, pulseDelayMs = 0 }) => (
  <div className="flex flex-col items-center text-center group cursor-pointer">
    <div
      className="phraze-toolitem-pulse w-[68px] h-[68px] bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)] flex items-center justify-center mb-3 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:border-gray-200 group-hover:[animation-play-state:paused]"
      style={{ animationDelay: `${pulseDelayMs}ms` }}
    >
      <Icon className="w-7 h-7 text-slate-800 stroke-[1.5]" />
    </div>
    <h3 className="font-bold text-slate-900 text-[13px] mb-0.5">{label}</h3>
    <p className="text-[11px] text-slate-400 font-medium">{subLabel}</p>
  </div>
);

const BentoCard = ({ className = '', padClass = 'p-8', children }) => (
  <div className={`bg-[#FAF9F6] rounded-[32px] border border-[#EBE9E4] ${padClass} h-[440px] flex flex-col relative select-none overflow-hidden ${className}`}>{children}</div>
);

const AnnotationHistoryItem = ({ item, isExpanded }) => {
  const tagStyle = (tone) => {
    if (tone === 'positive') {
      return {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 500,
        lineHeight: 1.3,
        backgroundColor: 'rgb(236, 253, 245)',
        border: '1px solid rgb(52, 211, 153)',
        color: 'rgb(6, 95, 70)',
        whiteSpace: 'nowrap',
      };
    }

    if (tone === 'negative') {
      return {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 500,
        lineHeight: 1.3,
        backgroundColor: 'rgb(254, 242, 242)',
        border: '1px solid rgb(252, 165, 165)',
        color: 'rgb(153, 27, 27)',
        whiteSpace: 'nowrap',
      };
    }

    return {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 8px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 500,
      lineHeight: 1.3,
      backgroundColor: 'rgb(239, 246, 255)',
      border: '1px solid rgb(147, 197, 253)',
      color: 'rgb(30, 64, 175)',
      whiteSpace: 'nowrap',
    };
  };

  return (
    <button
      type="button"
      style={{
        width: '100%',
        textAlign: 'left',
        border: '1px solid rgb(229, 231, 235)',
        backgroundColor: 'rgb(255, 255, 255)',
        borderRadius: '10px',
        padding: '9px 11px 24px',
        position: 'relative',
        cursor: 'default',
        transform: 'translateX(0px)',
        opacity: 1,
        pointerEvents: 'none',
        willChange: 'transform, opacity',
        transition:
          'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms cubic-bezier(0.22, 1, 0.36, 1)',
        touchAction: 'pan-y',
      }}
      tabIndex={-1}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <div
          style={{
            fontSize: '14px',
            lineHeight: 1.35,
            color: 'rgb(17, 24, 39)',
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            flex: '1 1 0%',
          }}
        >
          {item.summary}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
        <span style={tagStyle(item.sentimentTone)}>{`Sentiment: ${item.sentimentLabel}`}</span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 8px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 500,
            lineHeight: 1.3,
            backgroundColor: 'rgb(249, 250, 251)',
            border: '1px solid rgb(229, 231, 235)',
            color: 'rgb(55, 65, 81)',
            whiteSpace: 'nowrap',
          }}
        >
          {item.type}
        </span>
      </div>

      <div style={{ fontSize: '12px', color: 'rgb(156, 163, 175)', position: 'absolute', right: '11px', bottom: '7px' }}>
        {item.when}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateRows: isExpanded ? '1fr' : '0fr',
          transition: 'grid-template-rows 140ms ease-out',
          marginTop: isExpanded ? '8px' : '0px',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div
            style={{
              fontSize: '13px',
              color: 'rgb(55, 65, 81)',
              lineHeight: 1.5,
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              opacity: isExpanded ? 1 : 0,
              transform: isExpanded ? 'translateY(0px)' : 'translateY(-2px)',
              transition: 'opacity 120ms ease-out, transform 120ms ease-out',
            }}
          >
            {item.details}
          </div>
        </div>
      </div>
    </button>
  );
};

const EmptyBentoPage = ({ revealActive = false }) => {
  const [expandedHistoryId, setExpandedHistoryId] = useState('h2');
  const historyScrollRef = useRef(null);
  const historyItemRefs = useRef({});
  const dataScrollRef = useRef(null);
  const [exportButtonClicked, setExportButtonClicked] = useState(false);
  const [importButtonClicked, setImportButtonClicked] = useState(false);

  const annotationHistory = [
    {
      id: 'h1',
      summary: '“Non intrusive oil” could mean a few different things. Want the energy definition or the networking one?',
      details:
        'I saved this response because it clarifies ambiguity and offers options. You can label this highlight as “Disambiguation” and add a quick note explaining which definition you chose.',
      sentimentTone: 'neutral',
      sentimentLabel: 'Neutral',
      type: 'Clarification',
      when: 'just now',
    },
    {
      id: 'h2',
      summary: 'Tagged “Core Web Vitals” and added a note to track LCP and INP for the next release.',
      details:
        'Label: Metrics. Code: WEBVITALS 001. Note: Measure on mobile first, compare before and after, and attach the baseline screenshot in the thread.',
      sentimentTone: 'positive',
      sentimentLabel: 'Positive',
      type: 'Label + Note',
      when: '2 min ago',
    },
    {
      id: 'h3',
      summary: 'Marked this answer as “Needs sourcing” before sharing externally.',
      details:
        'Reason: the claim is plausible but not cited. Add a source link to the highlight or rephrase to keep it conservative for the doc.',
      sentimentTone: 'negative',
      sentimentLabel: 'Caution',
      type: 'Review',
      when: '12 min ago',
    },
    {
      id: 'h4',
      summary: 'Created a highlight for the rollout checklist and assigned it to Priya.',
      details:
        'Checklist includes: verify staging, run Lighthouse, validate analytics events, and post the changelog snippet in the channel.',
      sentimentTone: 'positive',
      sentimentLabel: 'Positive',
      type: 'Assignment',
      when: '1 hr ago',
    },
  ];

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mediaQuery?.matches) return;
    if (!annotationHistory.length) return;

    let idx = Math.max(0, annotationHistory.findIndex((i) => i.id === expandedHistoryId));
    if (idx < 0) idx = 0;

    const id = window.setInterval(() => {
      idx = (idx + 1) % annotationHistory.length;
      setExpandedHistoryId(annotationHistory[idx].id);
    }, 2200);

    return () => window.clearInterval(id);
    // Intentionally run once for "video" autoplay
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const scroller = historyScrollRef.current;
    const el = expandedHistoryId ? historyItemRefs.current?.[expandedHistoryId] : null;
    if (!scroller || !el) return;

    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const behavior = mediaQuery?.matches ? 'auto' : 'smooth';
    const padding = 10;

    const raf = window.requestAnimationFrame(() => {
      const sRect = scroller.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();

      if (eRect.top < sRect.top + padding) {
        const delta = sRect.top + padding - eRect.top;
        const next = Math.max(0, scroller.scrollTop - delta);
        try {
          scroller.scrollTo({ top: next, behavior });
        } catch (_) {
          scroller.scrollTop = next;
        }
      } else if (eRect.bottom > sRect.bottom - padding) {
        const delta = eRect.bottom - (sRect.bottom - padding);
        const next = Math.min(scroller.scrollHeight, scroller.scrollTop + delta);
        try {
          scroller.scrollTo({ top: next, behavior });
        } catch (_) {
          scroller.scrollTop = next;
        }
      }
    });

    return () => window.cancelAnimationFrame(raf);
  }, [expandedHistoryId]);

  useEffect(() => {
    const scrollContainer = dataScrollRef.current;
    if (!scrollContainer) return;

    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mediaQuery?.matches) {
      scrollContainer.scrollTop = 0;
      return;
    }

    let rafId = null;
    let t1 = null;
    let t2 = null;
    let t3 = null;
    let loopId = null;
    let target = 0;

    const tick = () => {
      const maxScroll = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
      const current = scrollContainer.scrollTop;
      const next = current + (target - current) * 0.08;
      scrollContainer.scrollTop = next;
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    const runSequence = () => {
      const maxScroll = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
      target = maxScroll;

      t1 = window.setTimeout(() => {
        setExportButtonClicked(true);
      }, 520);

      t2 = window.setTimeout(() => {
        setExportButtonClicked(false);
      }, 920);

      t3 = window.setTimeout(() => {
        setImportButtonClicked(true);
        window.setTimeout(() => setImportButtonClicked(false), 320);
      }, 1550);

      window.setTimeout(() => {
        target = 0;
      }, 2600);
    };

    runSequence();
    loopId = window.setInterval(runSequence, 5200);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      if (t1) window.clearTimeout(t1);
      if (t2) window.clearTimeout(t2);
      if (t3) window.clearTimeout(t3);
      if (loopId) window.clearInterval(loopId);
    };
  }, []);

  return (
    <div>
      <style>{`
        .phraze-hide-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .phraze-hide-scrollbar::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
      `}</style>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
        <div
          className={`bg-[#FAF9F6] rounded-[32px] border border-[#EBE9E4] p-4 h-[440px] md:col-span-7 flex flex-col relative select-none overflow-hidden phraze-bento-reveal ${revealActive ? 'is-revealed' : ''}`}
          style={{ transitionDelay: '0ms' }}
        >
          <div className="flex-1 min-h-0">
            <SecondPageChatDemo />
          </div>
        </div>
        <div
          className={`bg-[#FAF9F6] rounded-[32px] border border-[#EBE9E4] p-8 h-[440px] md:col-span-5 flex flex-col relative select-none overflow-hidden phraze-bento-reveal ${revealActive ? 'is-revealed' : ''}`}
          style={{ transitionDelay: '140ms' }}
        >
          <div className="mb-4">
            <h3 className="text-lg font-serif font-bold text-slate-900">Annotation History</h3>
            <p className="text-slate-500 text-sm font-light mt-1">A running log of saved highlights, labels, and quick notes.</p>
          </div>

          <div className="flex-1 min-h-0" style={{ width: '100%' }}>
            <div
              style={{
                width: '100%',
                height: '100%',
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '10px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                overflow: 'hidden',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>Recent</div>
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>{`${annotationHistory.length} items`}</div>
              </div>

              <div style={{ width: '100%', flex: 1, position: 'relative', overflow: 'hidden' }}>
                <div
                  ref={historyScrollRef}
                  style={{
                    width: '100%',
                    height: '100%',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    overscrollBehavior: 'contain',
                    paddingBottom: '18px',
                    boxSizing: 'border-box',
                    WebkitMaskImage:
                      'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,1) 68%, rgba(0,0,0,0) 100%)',
                    maskImage:
                      'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,1) 68%, rgba(0,0,0,0) 100%)',
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskSize: '100% 100%',
                    maskSize: '100% 100%',
                  }}
                >
                  {annotationHistory.map((item) => (
                    <div key={item.id} ref={(el) => (historyItemRefs.current[item.id] = el)}>
                      <AnnotationHistoryItem item={item} isExpanded={expandedHistoryId === item.id} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mt-10">
        <div
          className={`bg-[#FAF9F6] rounded-[32px] border border-[#EBE9E4] p-8 h-[440px] md:col-span-4 flex flex-col relative select-none overflow-hidden phraze-bento-reveal ${revealActive ? 'is-revealed' : ''}`}
          style={{ transitionDelay: '280ms' }}
        >
          <div className="mb-4">
            <h3 className="text-lg font-serif font-bold text-slate-900">Contact</h3>
            <p className="text-slate-500 text-sm font-light mt-1">Choose a teammate, preview their latest message, and jump into the thread instantly.</p>
          </div>

          <div className="flex-1 min-h-0">
            <ContactBento />
          </div>
        </div>

        <div
          className={`bg-[#FAF9F6] rounded-[32px] border border-[#EBE9E4] p-8 h-[440px] md:col-span-4 flex flex-col relative select-none overflow-hidden phraze-bento-reveal ${revealActive ? 'is-revealed' : ''}`}
          style={{ transitionDelay: '420ms' }}
        >
          <div className="mb-4">
            <h3 className="text-lg font-serif font-bold text-slate-900">Import & Export</h3>
            <p className="text-slate-500 text-sm font-light mt-1">Export your annotations for backup or sharing, or import previously exported data.</p>
          </div>

          <div className="bg-white rounded-[32px] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5 flex flex-col flex-1 min-h-0">
            <div
              ref={dataScrollRef}
              className="phraze-hide-scrollbar"
              style={{
                width: '100%',
                height: '100%',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                pointerEvents: 'none',
                borderRadius: 16,
                border: '1px solid #e5e7eb',
                padding: 16,
                paddingTop: 18,
              }}
            >
              <p
                style={{
                  margin: 0,
                  marginBottom: 16,
                  fontSize: 12,
                  color: '#71717a',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  lineHeight: 1.5,
                }}
              >
                Export your annotations to a file for backup or sharing, or import previously exported annotation data.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    background: exportButtonClicked ? '#f1f5f9' : '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    transition: 'all 0.15s ease',
                    transform: exportButtonClicked ? 'scale(0.96)' : 'scale(1)',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#334155',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    Export Data
                  </span>
                </div>

                <div
                  style={{
                    padding: '12px 16px',
                    background: importButtonClicked ? '#f1f5f9' : '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    transition: 'all 0.15s ease',
                    transform: importButtonClicked ? 'scale(0.96)' : 'scale(1)',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#334155',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    Import Data
                  </span>
                </div>
              </div>

              <p
                style={{
                  margin: 0,
                  marginBottom: 10,
                  fontSize: 12,
                  color: '#71717a',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  lineHeight: 1.5,
                }}
              >
                Share your annotations with others using a unique link.
              </p>

              <div
                style={{
                  padding: '12px 16px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'all 0.2s ease',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#334155',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Share and View
                </span>
              </div>

              <div style={{ marginTop: 20 }}>
                <h3
                  style={{
                    margin: 0,
                    marginBottom: 12,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#64748b',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  Recent Exports
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { name: 'ml-annotations-2024.json', date: '2 hours ago', size: '1.2 MB' },
                    { name: 'dataset-labels.json', date: 'Yesterday', size: '856 KB' },
                    { name: 'training-notes.json', date: '3 days ago', size: '324 KB' },
                  ].map((file, idx) => (
                    <div
                      key={file.name}
                      style={{
                        padding: '10px 12px',
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        opacity: idx === 2 ? 0.92 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: '#18181b',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              letterSpacing: '-0.01em',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {file.name}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: '#a1a1aa',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              marginTop: 2,
                            }}
                          >
                            {file.date} · {file.size}
                          </div>
                        </div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4d4d8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ height: 18 }} />
            </div>
          </div>
        </div>
        <div
          className={`bg-[#FAF9F6] rounded-[32px] border border-[#EBE9E4] p-8 h-[440px] md:col-span-4 flex flex-col relative select-none overflow-hidden phraze-bento-reveal ${revealActive ? 'is-revealed' : ''}`}
          style={{ transitionDelay: '560ms' }}
        >
          <div className="mb-4">
            <h3 className="text-lg font-serif font-bold text-slate-900">RBAC</h3>
            <p className="text-slate-500 text-sm font-light mt-1">
              Give the right access to the right people. Owners manage, editors collaborate, viewers observe.
            </p>
          </div>

          <div className="h-[300px] bg-white rounded-[24px] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-3.5 overflow-hidden flex flex-col">
            <div className="flex items-start justify-between gap-2 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="text-[11px] font-semibold text-slate-600">Roles</div>
              <div className="flex flex-wrap justify-end items-center gap-1.5 pr-1">
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-50 border border-amber-200">
                  <Users className="w-3.5 h-3.5 text-amber-700" />
                  <span className="text-[11px] font-medium text-amber-900">Owner</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-50 border border-blue-200">
                  <Tag className="w-3.5 h-3.5 text-blue-700" />
                  <span className="text-[11px] font-medium text-blue-900">Editor</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-50 border border-slate-200">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-700" />
                  <span className="text-[11px] font-medium text-slate-900">Viewer</span>
                </div>
              </div>
            </div>

            <div className="mt-2.5 rounded-2xl border border-gray-100 overflow-hidden">
              <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-100">
                <div className="px-2 py-2 text-[11px] font-semibold text-slate-600">Permission</div>
                <div className="px-2 py-2 text-[11px] font-semibold text-slate-600 text-center">Owner</div>
                <div className="px-2 py-2 text-[11px] font-semibold text-slate-600 text-center">Editor</div>
                <div className="px-2 py-2 text-[11px] font-semibold text-slate-600 text-center">Viewer</div>
              </div>

              {[
                { label: 'View', o: true, e: true, v: true },
                { label: 'Edit', o: true, e: true, v: false },
                { label: 'Manage access', o: true, e: false, v: false },
              ].map((row) => (
                <div key={row.label} className="grid grid-cols-4 border-b border-gray-100 last:border-b-0 bg-white">
                  <div className="px-2 py-2 text-[11px] text-slate-700">{row.label}</div>
                  <div className="px-2 py-2 flex justify-center">
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${row.o ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${row.o ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                    </div>
                  </div>
                  <div className="px-2 py-2 flex justify-center">
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${row.e ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${row.e ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                    </div>
                  </div>
                  <div className="px-2 py-2 flex justify-center">
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${row.v ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${row.v ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2.5 text-[11px] text-slate-500">Owner can manage roles. Editors can edit. Viewers are read-only.</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CollaboratorAvatars = () => {
  return (
    <div className="flex -space-x-2 overflow-hidden items-center justify-center p-1 bg-white rounded-full shadow-sm border border-gray-100">
      <img
        className="inline-block h-6 w-6 rounded-full ring-2 ring-white"
        src="https://picsum.photos/seed/user1/100/100"
        alt="User 1"
      />
      <img
        className="inline-block h-6 w-6 rounded-full ring-2 ring-white"
        src="https://picsum.photos/seed/user2/100/100"
        alt="User 2"
      />
      <img
        className="inline-block h-6 w-6 rounded-full ring-2 ring-white"
        src="https://picsum.photos/seed/user3/100/100"
        alt="User 3"
      />
      <div className="h-6 w-6 rounded-full ring-2 ring-white bg-gray-100 flex items-center justify-center text-[10px] text-gray-500 font-medium">
        +2
      </div>
    </div>
  );
};

export const LiveCollaborationCard = () => {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 3);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const users = [
    { id: 'P', label: 'highlight', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', dot: 'bg-indigo-500', icon: Highlighter, avatarSrc: '/priya.png', position: { x: 18, y: 46 }, linePosition: { x: 18, y: 46 }, nodeOffset: { x: -10, y: -14 } },
    { id: 'A', label: 'label', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500', icon: Tag, avatarSrc: '/alex.png', position: { x: 82, y: 46 }, linePosition: { x: 82, y: 46 }, nodeOffset: { x: -6, y: -14 } },
    { id: 'M', label: 'comment', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', icon: MessageSquare, avatarSrc: '/maya.png', position: { x: 50, y: 82 }, linePosition: { x: 50, y: 82 }, nodeOffset: { x: -16, y: 0 } },
  ];

  const centerPos = { x: 50, y: 40 };

  return (
    <div className="w-full h-full bg-white rounded-3xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden transition-all hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)]">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gray-50 rounded-lg border border-gray-100">
              <Users className="w-3.5 h-3.5 text-gray-700" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm tracking-tight">Collaboration</h3>
          </div>
        </div>

        <div className="flex items-center px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100 shadow-sm">
          <div className="flex gap-2">
            {users.map((u, i) => (
              <div
                key={u.id}
                className={`w-6 h-6 rounded-full border-2 border-white overflow-hidden flex items-center justify-center bg-transparent transition-all duration-500 ${activeStep === i ? 'opacity-100 scale-110 shadow-sm' : 'opacity-40 scale-100'}`}
              >
                <img src={u.avatarSrc} alt={u.id} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 relative mx-4 mb-6 bg-transparent rounded-2xl min-h-[200px]">
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-0">
          {users.map((user) => (
            <line
              key={user.id}
              x1={`${(user.linePosition ?? user.position).x}%`}
              y1={`${(user.linePosition ?? user.position).y}%`}
              x2={`${centerPos.x}%`}
              y2={`${centerPos.y}%`}
              stroke="#cbd5e1"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="4 6"
            />
          ))}
        </svg>

        {users.map((user, index) => {
          const isActive = activeStep === index;
          const particlePos = user.linePosition ?? user.position;
          return (
            isActive && (
              <motion.div
                key={`particle-${index}`}
                className={`absolute w-2 h-2 rounded-full ${user.dot} z-10 shadow-sm`}
                initial={{ left: `${particlePos.x}%`, top: `${particlePos.y}%`, opacity: 0 }}
                animate={{
                  left: [`${particlePos.x}%`, `${centerPos.x}%`],
                  top: [`${particlePos.y}%`, `${centerPos.y}%`],
                  opacity: [0, 1, 1, 0],
                }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.2 }}
                style={{ transform: 'translate(-50%, -50%)' }}
              />
            )
          );
        })}

        <div
          className="absolute z-20"
          style={{ left: `${centerPos.x}%`, top: `${centerPos.y}%`, transform: 'translate(-50%, -50%)' }}
        >
          <motion.div
            animate={activeStep !== null ? { scale: [1, 1.05, 1], boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' } : {}}
            transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 2.1 }}
            className="w-24 h-20 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col p-2.5 relative z-20"
          >
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="flex items-center gap-1.5 self-start">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                <div className="w-12 h-1.5 bg-gray-100 rounded-full" />
              </div>

              <div className="flex items-center gap-1.5 self-end flex-row-reverse">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 flex-shrink-0" />
                <div className="w-10 h-1.5 bg-indigo-50 rounded-full" />
              </div>

              <div className="flex items-center gap-1.5 self-start">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                <div className="w-8 h-1.5 bg-gray-100 rounded-full" />
              </div>
            </div>

            <div className="mt-auto w-full h-3 bg-gray-50 border border-gray-100 rounded-md flex items-center px-1">
              <div className="w-8 h-1 bg-gray-200 rounded-full opacity-50" />
            </div>

            <div className="absolute -top-3 -right-3">
              <CollaboratorAvatars />
            </div>
          </motion.div>
        </div>

        {users.map((user, index) => {
          const isActive = activeStep === index;
          const Icon = user.icon;
          const nodeOffset = user.nodeOffset ?? { x: 0, y: 0 };

          return (
            <div
              key={user.id}
              className="absolute z-30"
              style={{
                left: `${user.position.x}%`,
                top: `${user.position.y}%`,
                transform: `translate(${nodeOffset.x}px, ${nodeOffset.y}px)`,
              }}
            >
              <motion.div
                className={`w-8 h-8 rounded-full border-2 bg-white flex items-center justify-center text-[10px] font-bold shadow-sm transition-colors duration-300 ${
                  isActive ? `${user.border} ${user.color}` : 'border-gray-100 text-gray-300'
                }`}
                style={{ transform: 'translate(-50%, -50%)' }}
                animate={{ scale: isActive ? 1.15 : 1 }}
              >
                <img
                  src={user.avatarSrc}
                  alt={user.id}
                  className={`w-full h-full rounded-full object-cover ${isActive ? '' : 'opacity-50 grayscale'}`}
                />
              </motion.div>

              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                    className={`absolute top-5 left-1/2 px-2.5 py-1 bg-white rounded-md shadow-lg border text-[9px] font-bold uppercase tracking-wide flex items-center gap-1 whitespace-nowrap z-40 ${user.color} ${user.border}`}
                    style={{ transform: 'translateX(-50%)' }}
                  >
                    <Icon className="w-2.5 h-2.5" />
                    {user.label}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AnalyticsVisual = () => (
  <div className="w-full h-full min-w-0 flex items-center justify-center p-0 relative overflow-hidden">
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-gradient-to-br from-teal-50/40 to-indigo-50/40 rounded-full blur-3xl -z-10" />

    <div className="bg-white w-full max-w-[360px] rounded-2xl border border-gray-100 p-6 pb-[10px] relative z-10 overflow-hidden">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-slate-700">
            <IconBarChart3 className="w-4 h-4" />
          </div>
          <span className="font-semibold text-slate-700 text-sm">Annotation Statistics</span>
        </div>
      </div>

      <div className="relative h-24 w-full mb-6">
        <svg viewBox="0 0 300 100" className="w-full h-full">
          <defs>
            <linearGradient id="chartGradientHome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#64748b" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#64748b" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path d="M0,80 C40,80 60,30 100,30 S180,60 220,50 S260,20 300,20 L300,100 L0,100 Z" fill="url(#chartGradientHome)" />
          <path d="M0,80 C40,80 60,30 100,30 S180,60 220,50 S260,20 300,20" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
        </svg>

        <div className="flex justify-between mt-2 text-[10px] text-gray-400 font-medium px-1">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
          <span>Sun</span>
        </div>
      </div>

      <div className="border-t border-gray-50 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-slate-600">Positive Feedback</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 font-medium">Quantity</span>
            <span className="text-xs font-semibold text-slate-800">342</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs font-medium text-slate-600">Sentiment Analysis</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 font-medium">Quantity</span>
            <span className="text-xs font-semibold text-slate-800">856</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-xs font-medium text-slate-600">User Questions</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 font-medium">Quantity</span>
            <span className="text-xs font-semibold text-slate-800">194</span>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 56,
          background: 'linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.82) 62%, rgba(255,255,255,1))',
          pointerEvents: 'none',
        }}
      />
    </div>
  </div>
);

const ProjectOrganizationVisual = () => (
  <div
    style={{
      background: 'transparent',
      borderRadius: 24,
      padding: 0,
      margin: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <div style={{ width: '100%', position: 'relative' }}>
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0px 0px 28px',
          background: 'transparent',
          position: 'relative',
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: 290 }}>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              transform: 'translateX(-50%) translateY(0px)',
              width: '100%',
              zIndex: 40,
              background: 'rgb(255, 255, 255)',
              border: '1px solid rgb(229, 231, 235)',
              borderRadius: '6px 6px 0px 0px',
              boxShadow: 'rgba(0, 0, 0, 0.08) 0px 4px 12px, rgba(0, 0, 0, 0.04) 0px 2px 4px',
              overflow: 'hidden',
              opacity: 1,
              transition: '0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    background: 'rgb(244, 244, 245)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: '1px solid rgb(229, 231, 235)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div style={{ flex: '1 1 0%', minWidth: 0, paddingTop: 1 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'rgb(24, 24, 27)',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      letterSpacing: '-0.01em',
                      lineHeight: 1.4,
                    }}
                  >
                    Project Alpha
                  </h3>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 10,
                        color: 'rgb(82, 82, 91)',
                        fontWeight: 500,
                        letterSpacing: '-0.01em',
                        background: 'rgb(244, 244, 245)',
                        padding: '3px 8px',
                        borderRadius: 12,
                        border: '1px solid rgb(228, 228, 231)',
                      }}
                    >
                      12 threads
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: 'rgb(82, 82, 91)',
                        fontWeight: 500,
                        letterSpacing: '-0.01em',
                        background: 'rgb(244, 244, 245)',
                        padding: '3px 8px',
                        borderRadius: 12,
                        border: '1px solid rgb(228, 228, 231)',
                      }}
                    >
                      5 annotations
                    </span>
                  </div>
                </div>
                <div style={{ flexShrink: 0, paddingTop: 2 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4d4d8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 78,
              transform: 'translateX(-50%) translateY(0px)',
              width: '100%',
              zIndex: 30,
              background: 'rgb(255, 255, 255)',
              border: '1px solid rgb(229, 231, 235)',
              borderRadius: '6px 6px 0px 0px',
              boxShadow: 'rgba(0, 0, 0, 0.06) 0px 3px 8px, rgba(0, 0, 0, 0.03) 0px 1px 3px',
              overflow: 'hidden',
              opacity: 0.92,
              transition: '0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    background: 'rgb(244, 244, 245)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: '1px solid rgb(229, 231, 235)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div style={{ flex: '1 1 0%', minWidth: 0, paddingTop: 1 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'rgb(24, 24, 27)',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      letterSpacing: '-0.01em',
                      lineHeight: 1.4,
                    }}
                  >
                    Project Beta
                  </h3>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 10,
                        color: 'rgb(82, 82, 91)',
                        fontWeight: 500,
                        letterSpacing: '-0.01em',
                        background: 'rgb(244, 244, 245)',
                        padding: '3px 8px',
                        borderRadius: 12,
                        border: '1px solid rgb(228, 228, 231)',
                      }}
                    >
                      8 threads
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: 'rgb(82, 82, 91)',
                        fontWeight: 500,
                        letterSpacing: '-0.01em',
                        background: 'rgb(244, 244, 245)',
                        padding: '3px 8px',
                        borderRadius: 12,
                        border: '1px solid rgb(228, 228, 231)',
                      }}
                    >
                      3 annotations
                    </span>
                  </div>
                </div>
                <div style={{ flexShrink: 0, paddingTop: 2 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4d4d8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 156,
              transform: 'translateX(-50%) translateY(0px)',
              width: '100%',
              zIndex: 20,
              background: 'rgb(255, 255, 255)',
              border: '1px solid rgb(229, 231, 235)',
              borderRadius: '6px 6px 0px 0px',
              boxShadow: 'rgba(0, 0, 0, 0.04) 0px 2px 6px, rgba(0, 0, 0, 0.02) 0px 1px 2px',
              overflow: 'hidden',
              opacity: 0.78,
              transition: '0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    background: 'rgb(244, 244, 245)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: '1px solid rgb(229, 231, 235)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div style={{ flex: '1 1 0%', minWidth: 0, paddingTop: 1 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'rgb(24, 24, 27)',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      letterSpacing: '-0.01em',
                      lineHeight: 1.4,
                    }}
                  >
                    Project Gamma
                  </h3>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 10,
                        color: 'rgb(82, 82, 91)',
                        fontWeight: 500,
                        letterSpacing: '-0.01em',
                        background: 'rgb(244, 244, 245)',
                        padding: '3px 8px',
                        borderRadius: 12,
                        border: '1px solid rgb(228, 228, 231)',
                      }}
                    >
                      15 threads
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: 'rgb(82, 82, 91)',
                        fontWeight: 500,
                        letterSpacing: '-0.01em',
                        background: 'rgb(244, 244, 245)',
                        padding: '3px 8px',
                        borderRadius: 12,
                        border: '1px solid rgb(228, 228, 231)',
                      }}
                    >
                      7 annotations
                    </span>
                  </div>
                </div>
                <div style={{ flexShrink: 0, paddingTop: 2 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4d4d8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 234,
              transform: 'translateX(-50%) translateY(0px)',
              width: '100%',
              zIndex: 10,
              background: 'rgb(255, 255, 255)',
              border: '1.5px dashed rgb(209, 213, 219)',
              borderRadius: '6px 6px 0px 0px',
              boxShadow: 'rgba(0, 0, 0, 0.03) 0px 1px 3px',
              overflow: 'hidden',
              opacity: 0.64,
              transition: '0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    background: 'rgb(250, 250, 250)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: '1px solid rgb(229, 231, 235)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <div style={{ flex: '1 1 0%', minWidth: 0, paddingTop: 1 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'rgb(113, 113, 122)',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      letterSpacing: '-0.01em',
                      lineHeight: 1.4,
                    }}
                  >
                    Create New Project
                  </h3>
                  <p
                    style={{
                      margin: '6px 0px 0px',
                      fontSize: 13,
                      color: 'rgb(161, 161, 170)',
                      letterSpacing: '-0.01em',
                      lineHeight: 1.4,
                    }}
                  >
                    Start a new workspace
                  </p>
                </div>
                <div style={{ flexShrink: 0, paddingTop: 2 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4d4d8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 140,
          background:
            'linear-gradient(to bottom, rgba(250,249,246,0) 0%, rgba(250,249,246,0.18) 28%, rgba(250,249,246,0.75) 68%, rgba(250,249,246,1) 100%)',
          pointerEvents: 'none',
          borderRadius: 24,
        }}
      />
    </div>
  </div>
);

const ToolsAndAnalyticsSection = () => {
  const headerRef = useRef(null);
  const headerBottomLineRef = useRef(null);
  const conveyorOuterRef = useRef(null);
  const conveyorTrackRef = useRef(null);
  const stickyInnerRef = useRef(null);
  const rafRef = useRef(null);
  const didSnapRef = useRef(false);
  const snappingRef = useRef(false);
  const lastWheelTsRef = useRef(0);
  const wheelIdleTimerRef = useRef(null);
  const lastWheelWasTrackpadRef = useRef(false);
  const startRef = useRef(0);
  const endRef = useRef(0);
  const stickyTopPxRef = useRef(96);
  const [conveyorX, setConveyorX] = useState(0);
  const [conveyorMax, setConveyorMax] = useState(0);
  const [stickyTopPx, setStickyTopPx] = useState(96);
  const [revealActive, setRevealActive] = useState(false);
  const revealWasOutRef = useRef(true);
  const [isSecondScreen, setIsSecondScreen] = useState(false);
  const [secondRevealActive, setSecondRevealActive] = useState(false);
  const secondWasOutRef = useRef(true);

  useEffect(() => {
    const computeStickyTop = () => {
      const el = stickyInnerRef.current;
      if (!el) return;
      const viewportH = window.innerHeight;
      const h = el.getBoundingClientRect().height;
      const visualOffset = 40;
      const next = Math.max(24, Math.floor((viewportH - h) / 2) + visualOffset);
      stickyTopPxRef.current = next;
      setStickyTopPx(next);
    };

    computeStickyTop();
    window.addEventListener('resize', computeStickyTop);
    return () => window.removeEventListener('resize', computeStickyTop);
  }, []);

  useEffect(() => {
    const sectionEl = conveyorOuterRef.current;
    if (!sectionEl) return;

    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mediaQuery?.matches) {
      setRevealActive(true);
      return;
    }

    if (!('IntersectionObserver' in window)) {
      setRevealActive(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting) {
          if (revealWasOutRef.current) {
            revealWasOutRef.current = false;
            setRevealActive(false);
            window.requestAnimationFrame(() => {
              window.requestAnimationFrame(() => {
                setRevealActive(true);
              });
            });
          }
        } else {
          revealWasOutRef.current = true;
          setRevealActive(false);
        }
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -10% 0px'
      }
    );

    observer.observe(sectionEl);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isSecondScreen) {
      if (secondWasOutRef.current) {
        secondWasOutRef.current = false;
        setSecondRevealActive(false);
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            setSecondRevealActive(true);
          });
        });
      }
    } else {
      secondWasOutRef.current = true;
      setSecondRevealActive(false);
    }
  }, [isSecondScreen]);

  const toolItems = [
    { icon: IconTag, label: 'Labels', subLabel: 'Active' },
    { icon: IconFileText, label: 'Notes', subLabel: 'Synced' },
    { icon: IconUsers, label: 'Collaboration', subLabel: 'Is live' },
    { icon: IconSearch, label: 'Search', subLabel: 'Annotations' },
  ];

  useEffect(() => {
    const outer = conveyorOuterRef.current;
    const track = conveyorTrackRef.current;
    if (!outer || !track) return;

    const onWheel = (e) => {
      const absY = Math.abs(e?.deltaY ?? 0);
      const absX = Math.abs(e?.deltaX ?? 0);
      const deltaMode = e?.deltaMode ?? 0;

      // Heuristic: trackpads typically emit many small pixel deltas (deltaMode === 0)
      // while mouse wheels tend to emit larger step deltas.
      const isLikelyTrackpad = deltaMode === 0 && (absY > 0 && absY < 50 || absX > 0);

      lastWheelWasTrackpadRef.current = Boolean(isLikelyTrackpad);
      lastWheelTsRef.current = Date.now();
      if (wheelIdleTimerRef.current) {
        window.clearTimeout(wheelIdleTimerRef.current);
      }
      wheelIdleTimerRef.current = window.setTimeout(() => {
        wheelIdleTimerRef.current = null;
      }, 200);
    };

    const compute = () => {
      const outerRect = outer.getBoundingClientRect();
      const pageTop = window.scrollY + outerRect.top;
      const viewportH = window.innerHeight;

      const bottomLineEl = headerBottomLineRef.current;
      const bottomLineTopAbs = bottomLineEl ? window.scrollY + bottomLineEl.getBoundingClientRect().top : pageTop - viewportH * 0.25;

      const startOffset = Math.min(110, viewportH * 0.1);

      const desiredStart = bottomLineTopAbs - startOffset;
      const stickyStart = pageTop - stickyTopPxRef.current;
      const start = Math.max(desiredStart, stickyStart);
      const end = Math.max(start + 1, pageTop + outer.offsetHeight - viewportH * 0.75);

      const motionDelayPx = Math.min(140, viewportH * 0.14);
      const motionStart = start + motionDelayPx;

      const endHoldPx = Math.min(220, viewportH * 0.22);
      const motionEnd = Math.max(motionStart + 1, end - endHoldPx);

      startRef.current = start;
      endRef.current = end;

      const snapWindow = Math.min(140, viewportH * 0.14);
      const resetBuffer = Math.min(220, viewportH * 0.22);

      const isInSection = window.scrollY >= start - resetBuffer && window.scrollY <= end + resetBuffer;
      if (!isInSection) {
        didSnapRef.current = false;
      }

      const wheelIsActive = Date.now() - lastWheelTsRef.current < 200;
      const recentlyTrackpad = lastWheelWasTrackpadRef.current && Date.now() - lastWheelTsRef.current < 600;
      if (!recentlyTrackpad && !wheelIsActive && !didSnapRef.current && !snappingRef.current && window.scrollY > start && window.scrollY < start + snapWindow) {
        snappingRef.current = true;
        window.scrollTo({ top: start, behavior: 'smooth' });
        didSnapRef.current = true;
        window.setTimeout(() => {
          snappingRef.current = false;
        }, 180);
      }

      const progress = Math.min(1, Math.max(0, (window.scrollY - motionStart) / Math.max(1, motionEnd - motionStart)));
      const outerW = Math.max(1, outer.clientWidth);
      const maxTranslate = Math.max(0, track.scrollWidth - outerW);
      const translateX = progress * maxTranslate;
      setConveyorMax(maxTranslate);
      setConveyorX(translateX);

      const page = Math.round(translateX / outerW);
      setIsSecondScreen(page === 1);
    };

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        compute();
      });
    };

    compute();
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', compute);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (wheelIdleTimerRef.current) {
        window.clearTimeout(wheelIdleTimerRef.current);
        wheelIdleTimerRef.current = null;
      }
    };
  }, []);

  const fadeW = 46;
  const edgeFadeStrength = 0.32;
  const leftFadeAmt = conveyorMax > 0 ? Math.min(1, conveyorX / 120) : 0;
  const rightFadeAmtRaw = conveyorMax > 0 ? Math.min(1, (conveyorMax - conveyorX) / 120) : 0;
  const rightGatePx = 36;
  const rightGate = Math.min(1, Math.max(0, conveyorX / rightGatePx));
  const rightFadeAmt = rightFadeAmtRaw * rightGate;
  const leftEdgeAlpha = 1 - leftFadeAmt * edgeFadeStrength;
  const rightEdgeAlpha = 1 - rightFadeAmt * edgeFadeStrength;

  const chatAnnotationVisualHtml = `<div style="width: 100%; height: 100%; background: radial-gradient(ellipse at 50% 100%, rgba(34,211,238,0.22) 0%, rgba(34,211,238,0.11) 34%, rgba(34,211,238,0.05) 58%, rgba(255,255,255,0) 80%), linear-gradient(135deg, rgb(255, 254, 252) 0%, rgb(251, 252, 253) 55%, rgb(246, 248, 251) 100%); border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgb(226, 232, 240); box-shadow: rgba(0, 0, 0, 0.08) 0px 4px 16px, rgba(0, 0, 0, 0.06) 0px 2px 8px, rgba(255, 255, 255, 0.5) 0px 1px 0px inset; position: relative;"><div style="position: absolute; inset: 0px; background: radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.2) 0%, transparent 50%), radial-gradient(circle at 40% 60%, rgba(255, 255, 255, 0.1) 0%, transparent 50%); pointer-events: none; z-index: 1;"></div><div style="position: absolute; top: 15%; right: 10%; width: 4px; height: 4px; background: rgba(255, 255, 255, 0.6); border-radius: 50%; box-shadow: rgba(255, 255, 255, 0.8) 0px 0px 6px; z-index: 1;"></div><div style="position: absolute; top: 60%; left: 8%; width: 3px; height: 3px; background: rgba(255, 255, 255, 0.4); border-radius: 50%; box-shadow: rgba(255, 255, 255, 0.6) 0px 0px 4px; z-index: 1;"></div><div style="position: absolute; top: 80%; right: 20%; width: 2px; height: 2px; background: rgba(255, 255, 255, 0.5); border-radius: 50%; box-shadow: rgba(255, 255, 255, 0.7) 0px 0px 3px; z-index: 1;"></div><div style="flex: 1 1 0%; padding: 8px; display: flex; flex-direction: column; gap: 10px; justify-content: center; position: relative; z-index: 2;"><div style="display: flex; justify-content: flex-end;"><div style="background: linear-gradient(135deg, rgb(255, 255, 255) 0%, rgb(248, 250, 252) 100%); border-radius: 20px 20px 6px; padding: 14px 18px; max-width: 80%; font-size: 14px; line-height: 1.5; color: rgb(55, 65, 81); border: 1px solid rgb(229, 231, 235); box-shadow: rgba(0, 0, 0, 0.08) 0px 1px 4px, rgba(255, 255, 255, 0.8) 0px 1px 0px inset; position: relative;">Can you explain <span style="background-color: rgb(254, 243, 199); padding: 2px 4px; border-radius: 4px; font-weight: 500;">machine learning</span>?</div></div><div style="display: flex; justify-content: flex-start;"><div style="display: flex; flex-direction: column; max-width: 85%;"><div style="font-size: 0.8rem; margin-bottom: 8px; font-weight: 500; color: rgb(85, 85, 85); text-align: left; padding-right: 0rem; display: flex; align-items: center; gap: 0.5rem; justify-content: flex-start; padding-left: 16px;"><span>phraze</span><div style="width: 16px; height: 16px; border-radius: 50%; background-color: rgb(100, 116, 139); display: flex; align-items: center; justify-content: center; font-size: 0.5rem; font-weight: 600; color: white; border: 1px solid rgb(71, 85, 105);">P</div></div><div style="background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.9) 100%); border-radius: 20px 20px 20px 6px; padding: 16px 20px; font-size: 14px; line-height: 1.5; color: rgb(55, 65, 81); border: 1px solid rgba(229, 231, 235, 0.5); box-shadow: rgba(0, 0, 0, 0.06) 0px 1px 4px, rgba(255, 255, 255, 0.6) 0px 1px 0px inset; backdrop-filter: blur(10px); position: relative;"><span style="background-color: rgb(219, 234, 254); padding: 2px 4px; border-radius: 4px; font-weight: 500;">Machine learning</span> is a subset of AI that enables computers to learn and make decisions from data. Key concepts include <span style="background-color: rgb(220, 252, 231); padding: 2px 4px; border-radius: 4px; font-weight: 500;">neural networks</span>, <span style="background-color: rgb(252, 231, 243); padding: 2px 4px; border-radius: 4px; font-weight: 500;">algorithms</span>, and <span style="background-color: rgb(254, 243, 199); padding: 2px 4px; border-radius: 4px; font-weight: 500;">data preprocessing</span> techniques.</div></div></div></div><div style="padding: 8px 10px; border-top: 1px solid rgba(229, 231, 235, 0.3); background: rgb(255, 255, 255); border-radius: 0px 0px 16px 16px; position: relative; z-index: 2; backdrop-filter: blur(20px); box-shadow: rgba(255, 255, 255, 0.6) 0px 1px 0px inset;"><div style="display: flex; flex-flow: wrap; gap: 12px; align-items: center; justify-content: center;"><div style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: rgb(107, 114, 128);"><div style="width: 10px; height: 10px; background-color: rgb(254, 243, 199); border-radius: 2px;"></div><span>Technology</span></div><div style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: rgb(107, 114, 128);"><div style="width: 10px; height: 10px; background-color: rgb(219, 234, 254); border-radius: 2px;"></div><span>AI Concepts</span></div><div style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: rgb(107, 114, 128);"><div style="width: 10px; height: 10px; background-color: rgb(220, 252, 231); border-radius: 2px;"></div><span>Algorithms</span></div><div style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: rgb(107, 114, 128);"><div style="width: 10px; height: 10px; background-color: rgb(252, 231, 243); border-radius: 2px;"></div><span>Methods</span></div></div></div></div>`;

  return (
    <div className="w-full max-w-[1480px] mx-auto py-[72px] px-[24px]">
      <style>{`
        @keyframes phrazeToolItemPulse {
          0%, 72%, 100% {
            transform: translateY(0);
            box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.04);
            border-color: rgb(243 244 246);
          }
          12%, 24% {
            transform: translateY(-4px);
            box-shadow: 0 10px 20px -8px rgba(0, 0, 0, 0.14);
            border-color: rgb(229 231 235);
          }
        }

        .phraze-toolitem-pulse {
          animation: phrazeToolItemPulse 3200ms ease-in-out infinite;
        }

        .phraze-secondpage-chat {
          height: 100%;
        }

        .phraze-secondpage-chat > div {
          height: 100% !important;
          background: radial-gradient(ellipse at 50% 100%, rgba(34,211,238,0.22) 0%, rgba(34,211,238,0.11) 34%, rgba(34,211,238,0.05) 58%, rgba(255,255,255,0) 80%), linear-gradient(135deg, rgb(255, 254, 252) 0%, rgb(251, 252, 253) 55%, rgb(246, 248, 251) 100%) !important;
          border-radius: 16px !important;
          border: 1px solid rgb(226, 232, 240) !important;
          box-shadow: rgba(0, 0, 0, 0.08) 0px 4px 16px, rgba(0, 0, 0, 0.06) 0px 2px 8px, rgba(255, 255, 255, 0.5) 0px 1px 0px inset !important;
          overflow: hidden !important;
        }

        .phraze-secondpage-chat > div > div {
          height: 100% !important;
          overflow-y: auto !important;
          padding: 14px !important;
          scroll-snap-type: y mandatory;
          scroll-padding-top: 14px;
          padding-bottom: 24px !important;
        }

        .phraze-secondpage-chat > div > div > div {
          padding-left: 10px !important;
          padding-right: 10px !important;
          scroll-snap-align: start;
        }

        .phraze-secondpage-chat > div > div > div > div {
          max-width: 92% !important;
        }

        .phraze-secondpage-chat > div > div > div > div > div:nth-child(2) {
          background: linear-gradient(135deg, rgb(255, 255, 255) 0%, rgb(248, 250, 252) 100%) !important;
          border: 1px solid rgb(229, 231, 235) !important;
          border-radius: 20px 20px 6px !important;
          box-shadow: rgba(0, 0, 0, 0.06) 0px 2px 10px !important;
          padding: 14px 18px !important;
        }

        .phraze-secondpage-chat span[style*="background-color"] {
          background-color: rgba(254, 243, 199, 0.6) !important;
        }

        @media (prefers-reduced-motion: reduce) {
          .phraze-toolitem-pulse {
            animation: none;
          }

          .phraze-bento-reveal {
            opacity: 1 !important;
            transform: none !important;
            filter: none !important;
            transition: none !important;
          }

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

        .phraze-bento-reveal {
          opacity: 0;
          transform: translateY(28px) scale(0.98);
          filter: blur(6px);
          transition: opacity 760ms cubic-bezier(0.22, 1, 0.36, 1), transform 760ms cubic-bezier(0.22, 1, 0.36, 1), filter 760ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: opacity, transform, filter;
        }

        .phraze-bento-reveal.is-revealed {
          opacity: 1;
          transform: translateY(0) scale(1);
          filter: blur(0px);
        }
      `}</style>

      <div ref={headerRef} className="max-w-3xl mx-auto text-center mb-14">
        <div className={`relative left-1/2 -translate-x-1/2 w-screen h-px bg-gray-200/60 mb-8 phraze-reveal-apple ${revealActive ? 'is-revealed' : ''}`} style={{ transitionDelay: revealActive ? '0ms' : '0ms' }} />
        <div className={`phraze-reveal-apple ${revealActive ? 'is-revealed' : ''}`} style={{ transitionDelay: revealActive ? '0ms' : '0ms' }}>
          <span className="inline-flex rounded-full p-[1px] bg-gradient-to-r from-sky-500/70 via-blue-500/70 to-sky-500/70">
            <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[#FFFEFC] text-slate-700 text-[11px] font-semibold tracking-wide">
              Tools & analytics
            </span>
          </span>
        </div>
        <div className={`phraze-reveal-apple ${revealActive ? 'is-revealed' : ''}`} style={{ transitionDelay: revealActive ? '90ms' : '0ms' }}>
          <h2 className="mt-4 text-3xl md:text-4xl font-serif font-bold text-slate-900">Annotate your chats.</h2>
        </div>
        <div ref={headerBottomLineRef} className={`relative left-1/2 -translate-x-1/2 w-screen h-px bg-gray-200/60 mt-8 phraze-reveal-apple ${revealActive ? 'is-revealed' : ''}`} style={{ transitionDelay: revealActive ? '160ms' : '0ms' }} />
      </div>

      <div ref={conveyorOuterRef} className="relative mt-10">
        <div className="h-[240vh]">
          <div ref={stickyInnerRef} className="sticky" style={{ top: stickyTopPx }}>
            <div
              className="relative overflow-hidden"
              style={{
                WebkitMaskImage: `linear-gradient(to right, rgba(0,0,0,${leftEdgeAlpha}) 0px, rgba(0,0,0,1) ${fadeW}px, rgba(0,0,0,1) calc(100% - ${fadeW}px), rgba(0,0,0,${rightEdgeAlpha}) 100%)`,
                maskImage: `linear-gradient(to right, rgba(0,0,0,${leftEdgeAlpha}) 0px, rgba(0,0,0,1) ${fadeW}px, rgba(0,0,0,1) calc(100% - ${fadeW}px), rgba(0,0,0,${rightEdgeAlpha}) 100%)`,
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskSize: '100% 100%',
                maskSize: '100% 100%',
              }}
            >
              <div
                ref={conveyorTrackRef}
                className="flex gap-10 will-change-transform"
                style={{ transform: `translate3d(${-conveyorX}px, 0, 0)`, transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)' }}
              >
                {[0, 1].map((pageIndex) => (
                  <div key={`bento-page-${pageIndex}`} className="shrink-0 w-full">
                    {pageIndex === 1 ? (
                      <EmptyBentoPage revealActive={secondRevealActive} />
                    ) : (
                      <div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                          <div className={`bg-[#FAF9F6] rounded-[32px] border border-[#EBE9E4] p-8 h-[440px] flex flex-col relative select-none phraze-bento-reveal ${revealActive ? 'is-revealed' : ''}`} style={{ transitionDelay: '0ms' }}>
                            <div className="mb-6">
                              <h3 className="text-lg font-serif font-bold text-slate-900">Annotate your chats</h3>
                              <p className="text-slate-500 text-sm font-light mt-1">Highlight, code, and take notes directly in conversations so insights are always captured, organized, and never lost.</p>
                            </div>

                            <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-6 w-full max-w-md mx-auto mt-auto">
                              <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-slate-700">
                                  <IconWrench className="w-4 h-4" />
                                </div>
                                <span className="font-semibold text-slate-700 text-sm">Tools</span>
                              </div>
                              <div className="grid grid-cols-4 gap-4">
                                {toolItems.map((item, idx) => (
                                  <ToolItem
                                    key={item.label}
                                    icon={item.icon}
                                    label={item.label}
                                    subLabel={item.subLabel}
                                    pulseDelayMs={(pageIndex * 1200) + (idx * 260)}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className={`bg-[#FAF9F6] rounded-[32px] border border-[#EBE9E4] p-8 h-[440px] flex flex-col relative select-none phraze-bento-reveal ${revealActive ? 'is-revealed' : ''}`} style={{ transitionDelay: '140ms' }}>
                            <div className="mb-6">
                              <h3 className="text-lg font-serif font-bold text-slate-900">Project Organization</h3>
                              <p className="text-slate-500 text-sm font-light mt-1">Keep every thread, tag, and decision structured in one place.</p>
                            </div>
                            <div className="flex-1 min-h-0 flex items-center justify-center">
                              <div className="w-full">
                                <ProjectOrganizationVisual />
                              </div>
                            </div>
                          </div>

                          <div className={`bg-[#FAF9F6] rounded-[32px] border border-[#EBE9E4] p-8 h-[440px] flex flex-col relative select-none phraze-bento-reveal ${revealActive ? 'is-revealed' : ''}`} style={{ transitionDelay: '280ms' }}>
                            <div className="mb-4">
                              <h3 className="text-lg font-serif font-bold text-slate-900">{pageIndex % 2 === 0 ? 'Chat annotation' : 'Exports'}</h3>
                              <p className="text-slate-500 text-sm font-light mt-1">
                                {pageIndex % 2 === 0
                                  ? 'Highlight key phrases in the conversation and label them instantly.'
                                  : 'Share insights with a clean export your team can trust.'}
                              </p>
                            </div>
                            <div className="flex-1 min-h-0">
                              {pageIndex % 2 === 0 ? (
                                <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: chatAnnotationVisualHtml }} />
                              ) : (
                                <div className="bg-white rounded-3xl border border-gray-100 p-6 w-full max-w-md mx-auto">
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="text-[11px] font-semibold text-slate-700">Export report</div>
                                    <div className="text-[10px] font-medium text-slate-400">PDF · CSV</div>
                                  </div>
                                  <div className="h-10 bg-slate-50 border border-slate-100 rounded-2xl" />
                                  <div className="mt-3 space-y-2">
                                    <div className="h-2 bg-slate-100 rounded-full w-[88%]" />
                                    <div className="h-2 bg-slate-100 rounded-full w-[72%]" />
                                    <div className="h-2 bg-slate-100 rounded-full w-[80%]" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mt-10">
                          <div className={`bg-[#FAF9F6] rounded-[32px] border border-[#EBE9E4] p-8 h-[440px] md:col-span-7 flex flex-col phraze-bento-reveal ${revealActive ? 'is-revealed' : ''}`} style={{ transitionDelay: '420ms' }}>
                            <div className="mb-4">
                              <h3 className="text-lg font-serif font-bold text-slate-900">Live collaboration</h3>
                              <p className="text-slate-500 text-sm font-light mt-1">See changes merge in real time as your team annotates.</p>
                            </div>
                            <div className="flex-1 w-full">
                              <LiveCollaborationCard />
                            </div>
                          </div>
                          <div className={`bg-[#FAF9F6] rounded-[32px] border border-[#EBE9E4] p-8 h-[440px] md:col-span-5 flex flex-col phraze-bento-reveal ${revealActive ? 'is-revealed' : ''}`} style={{ transitionDelay: '560ms' }}>
                            <div className="mb-4">
                              <h3 className="text-lg font-serif font-bold text-slate-900">Analyze your data</h3>
                              <p className="text-slate-500 text-sm font-light mt-1">Visualize trends and uncover insights in your conversations with analytics tools.</p>
                            </div>
                            <div className="flex-1 flex items-center justify-center overflow-visible">
                              <AnalyticsVisual />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolsAndAnalyticsSection;
