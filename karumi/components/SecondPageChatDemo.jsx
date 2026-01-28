import React, { useCallback, useEffect, useRef, useState } from 'react';

const MAYA_AVATAR = "https://i.pravatar.cc/150?u=maya";
const ALEX_AVATAR = "https://i.pravatar.cc/150?u=alex";

const SCRIPT = [
  {
    senderType: 'user',
    senderName: 'Jin Liner',
    avatar: MAYA_AVATAR,
    text: "Hey! I'm trying to build a machine learning model for image recognition. Any tips on getting started?",
    highlights: ["Hey! I'm trying to build a machine learning model for image recognition. Any tips on getting started?"],
  },
  {
    senderType: 'ai',
    senderName: 'phraze',
    avatar: 'phraze',
    text: "Great question! For image recognition, I'd recommend starting with TensorFlow or PyTorch. Begin with pre-trained models like ResNet or VGG, then fine-tune them on your specific dataset.",
    highlights: ['TensorFlow or PyTorch', 'ResNet or VGG'],
  },
  {
    senderType: 'user',
    senderName: 'Alex Chen',
    avatar: ALEX_AVATAR,
    text: 'I started with TensorFlow too! The transfer learning approach saved me weeks of training time.',
    highlights: ['TensorFlow'],
  },
  {
    senderType: 'ai',
    senderName: 'phraze',
    avatar: 'phraze',
    text: "That's excellent! Transfer learning is indeed a game-changer. Since you're working with medical images, I'd recommend looking into architectures specifically designed for medical imaging like DenseNet or EfficientNet. They handle the fine details in medical scans much better than general-purpose models.",
    highlights: ['DenseNet or EfficientNet'],
  },
  {
    senderType: 'user',
    senderName: 'Jin Liner',
    avatar: MAYA_AVATAR,
    text: "@alex I'm working with medical images. Should I use a different architecture?",
    highlights: ["@alex I'm working with medical images. Should I use a different architecture?"],
  },
  {
    senderType: 'user',
    senderName: 'Alex Chen',
    avatar: ALEX_AVATAR,
    text: "@Jin For medical images, definitely consider U-Net or ResNet-50. They're proven performers in medical imaging. Also, make sure to use proper data augmentation techniques since medical datasets are often smaller.",
    highlights: ['U-Net or ResNet-50'],
  },
];

const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\[\]\\]]/g, '\\$&');
};

const ChatBubble = ({ message }) => {
  const isMe = message.senderName === 'Jin Liner';
  const isPhraze = message.senderName === 'phraze';

  const renderText = () => {
    const highlights = Array.isArray(message.highlights) ? message.highlights : [];
    if (highlights.length === 0) return message.text;

    const patterns = [...highlights]
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp);

    if (patterns.length === 0) return message.text;

    const regex = new RegExp(`(${patterns.join('|')})`, 'g');
    const parts = message.text.split(regex);

    return parts.map((part, idx) => {
      const isHighlight = highlights.includes(part);
      if (isHighlight) {
        return (
          <span key={idx} className="demo-highlight rounded px-0.5 box-decoration-clone">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div
      className={`
        w-full flex ${isMe ? 'mb-3' : 'mb-5'} px-0 ${isMe ? 'justify-end' : 'justify-start'}
      `}
    >
      <div className="flex flex-col max-w-[85%]">
        <div className={`demo-row-enter flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
          {!isPhraze ? (
            <img src={message.avatar} alt={message.senderName} className="w-[18px] h-[18px] rounded-full object-cover" />
          ) : (
            <div className="w-[18px] h-[18px] rounded-full bg-[rgb(100,116,139)] border border-[rgb(71,85,105)] flex items-center justify-center text-white text-[10px] font-bold">
              P
            </div>
          )}
          <span className="text-[0.8rem] font-[500] text-[rgb(85,85,85)]">{message.senderName}</span>
        </div>

        <div
          className={`
            demo-bubble-enter text-[0.875rem] leading-[1.35] relative z-10 py-3 px-4
            ${
              isMe
                ? 'bg-white rounded-[2rem] rounded-br-[5px]'
                : 'bg-white border border-[rgba(15,23,42,0.06)] rounded-[2rem] rounded-bl-[6px]'
            }
          `}
          style={{ whiteSpace: 'pre-wrap' }}
        >
          {renderText()}
        </div>
      </div>
    </div>
  );
};

const SecondPageChatDemo = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [typingState, setTypingState] = useState({ isTyping: false, senderName: '', avatar: '' });
  const [isInView, setIsInView] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isComposerDocked, setIsComposerDocked] = useState(false);
  const [isDockAnimating, setIsDockAnimating] = useState(false);
  const [isColdOpen, setIsColdOpen] = useState(false);
  const [sceneOpacity, setSceneOpacity] = useState(1);
  const [sceneBlur, setSceneBlur] = useState(0);
  const [isSendPressed, setIsSendPressed] = useState(false);

  const showComposerCaret = isActive && !isComposerDocked && inputValue.length > 0;

  const rootRef = useRef(null);
  const containerRef = useRef(null);
  const textareaRef = useRef(null);
  const timeoutsRef = useRef([]);

  const prevTextareaHeight = useRef(24);
  const prevDockedRef = useRef(false);
  const idCounterRef = useRef(0);
  const lastScrollTsRef = useRef(0);
  const wasActiveRef = useRef(false);
  const hasEverActivatedRef = useRef(false);
  const activateTimerRef = useRef(null);
  const deactivateTimerRef = useRef(null);
  const inactiveResetTimerRef = useRef(null);
  const latestRatioRef = useRef(0);
  const latestIntersectingRef = useRef(false);

  const makeId = useCallback(() => {
    const n = idCounterRef.current++;
    return `${Date.now()}-${n}`;
  }, []);

  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      wasActiveRef.current = true;
      if (!hasEverActivatedRef.current) {
        hasEverActivatedRef.current = true;
        setIsColdOpen(true);
        const id = setTimeout(() => setIsColdOpen(false), 520);
        return () => clearTimeout(id);
      }
    }

    if (!isActive) {
      wasActiveRef.current = false;
    }

    return undefined;
  }, [isActive]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const compute = () => {
      const rect = el.getBoundingClientRect();
      const viewportH = window.innerHeight || 0;
      const viewportW = window.innerWidth || 0;

      const height = Math.max(1, rect.height);
      const width = Math.max(1, rect.width);
      const visibleH = Math.max(0, Math.min(viewportH, rect.bottom) - Math.max(0, rect.top));
      const visibleW = Math.max(0, Math.min(viewportW, rect.right) - Math.max(0, rect.left));
      const ratioH = visibleH / height;
      const ratioW = visibleW / width;
      const ratio = Math.min(ratioH, ratioW);
      const isIntersecting = ratio > 0;

      latestRatioRef.current = ratio;
      latestIntersectingRef.current = isIntersecting;

      setIsInView((prev) => {
        const ENTER = 0.45;
        const EXIT = 0.16;
        if (!isIntersecting) return false;
        if (!prev && ratio >= ENTER) return true;
        if (prev && ratio <= EXIT) return false;
        return prev;
      });
    };

    let rafId = 0;
    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        compute();
      });
    };

    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const addTimeout = (fn, delay) => {
    const id = setTimeout(fn, delay);
    timeoutsRef.current.push(id);
    return id;
  };

  useEffect(() => {
    if (deactivateTimerRef.current) {
      clearTimeout(deactivateTimerRef.current);
      deactivateTimerRef.current = null;
    }

    if (isInView) {
      setIsActive(true);
    } else {
      deactivateTimerRef.current = setTimeout(() => {
        setIsActive(false);
      }, 520);
    }

    return () => {
      if (deactivateTimerRef.current) {
        clearTimeout(deactivateTimerRef.current);
        deactivateTimerRef.current = null;
      }
    };
  }, [isInView]);

  useEffect(() => {
    return () => {
      if (inactiveResetTimerRef.current) {
        clearTimeout(inactiveResetTimerRef.current);
        inactiveResetTimerRef.current = null;
      }
      if (activateTimerRef.current) {
        clearTimeout(activateTimerRef.current);
        activateTimerRef.current = null;
      }
      if (deactivateTimerRef.current) {
        clearTimeout(deactivateTimerRef.current);
        deactivateTimerRef.current = null;
      }
    };
  }, []);

  const scrollToBottom = (behavior = 'smooth') => {
    const el = containerRef.current;
    if (!el) return;

    const { scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight) return;

    requestAnimationFrame(() => {
      el.scrollTo({
        top: scrollHeight - clientHeight,
        behavior,
      });
    });
  };

  const scrollToBottomThrottled = useCallback(
    (behavior = 'auto', minIntervalMs = 80) => {
      const now = Date.now();
      if (now - lastScrollTsRef.current < minIntervalMs) return;
      lastScrollTsRef.current = now;
      scrollToBottom(behavior);
    },
    []
  );

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages.length, typingState.isTyping, isActive]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const rawHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(rawHeight, 128);
      textareaRef.current.style.height = `${newHeight}px`;

      if (Math.abs(newHeight - prevTextareaHeight.current) > 2) {
        scrollToBottomThrottled('auto', 90);
        prevTextareaHeight.current = newHeight;
      }
    }
  }, [inputValue, scrollToBottomThrottled]);

  const runSequence = useCallback(() => {
    let currentMsgIndex = 0;

    const processNextMessage = () => {
      if (currentMsgIndex >= SCRIPT.length) {
        addTimeout(() => {
          setSceneOpacity(0);
          setSceneBlur(2);
          addTimeout(() => {
            setMessages([]);
            setInputValue('');
            setIsComposerDocked(false);
            setTypingState({ isTyping: false, senderName: '', avatar: '' });
            setSceneOpacity(1);
            addTimeout(() => setSceneBlur(0), 220);
            addTimeout(() => runSequence(), 140);
          }, 260);
        }, 7000);
        return;
      }

      const scriptItem = SCRIPT[currentMsgIndex];
      const isLocalUser = scriptItem.senderName === 'Jin Liner';

      if (isLocalUser) {
        let delayStart = currentMsgIndex === 0 ? 800 : 1200;

        addTimeout(() => {
          const textToType = scriptItem.text;
          let charIndex = 0;

          const typeChar = () => {
            if (charIndex <= textToType.length) {
              setInputValue(textToType.slice(0, charIndex));
              charIndex++;
              const justTyped = textToType[Math.max(0, charIndex - 1)] ?? '';
              const isPunct = /[\.,!\?:;]/.test(justTyped);
              const base = Math.random() * 16 + 18;
              const punctPause = isPunct ? Math.random() * 60 + 45 : 0;
              const speed = base + punctPause;
              addTimeout(typeChar, speed);
            } else {
              addTimeout(() => {
                setIsComposerDocked(true);
                setIsSendPressed(true);
                addTimeout(() => setIsSendPressed(false), 180);
                setMessages((prev) => [...prev, { ...scriptItem, id: makeId() }]);
                setInputValue('');
                addTimeout(() => {
                  currentMsgIndex++;
                  processNextMessage();
                }, Math.round(90 + Math.random() * 110));
              }, 500);
            }
          };

          typeChar();
        }, delayStart);
      } else {
        const thinkingTime = Math.random() * 520 + (scriptItem.senderName === 'Alex Chen' ? 1050 : 780);

        setTypingState({
          isTyping: true,
          senderName: scriptItem.senderName,
          avatar: scriptItem.avatar,
        });

        addTimeout(() => {
          setTypingState({ isTyping: false, senderName: '', avatar: '' });

          const newMessageId = makeId();
          const fullText = scriptItem.text;

          setMessages((prev) => [...prev, { ...scriptItem, id: newMessageId, text: '' }]);

          let charIndex = 0;
          const streamChar = () => {
            if (charIndex <= fullText.length) {
              setMessages((prev) => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.id === newMessageId) {
                  const newText = fullText.slice(0, charIndex);
                  if (lastMsg.text === newText) return prev;
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1] = { ...lastMsg, text: newText };
                  return newMsgs;
                }
                return prev;
              });

              if (charIndex % 5 === 0) {
                scrollToBottomThrottled('auto', 90);
              }

              charIndex++;
              const justTyped = fullText[Math.max(0, charIndex - 1)] ?? '';
              const isPunct = /[\.,!\?:;]/.test(justTyped);
              const base = 9 + Math.random() * 5;
              const punctPause = isPunct ? 30 + Math.random() * 55 : 0;
              addTimeout(streamChar, Math.round(base + punctPause));
            } else {
              addTimeout(() => scrollToBottom('smooth'), 60);
              addTimeout(() => {
                currentMsgIndex++;
                processNextMessage();
              }, Math.round(120 + Math.random() * 140));
            }
          };

          streamChar();
        }, thinkingTime);
      }
    };

    processNextMessage();
  }, []);

  useEffect(() => {
    if (!isActive) {
      clearAllTimeouts();
      setTypingState({ isTyping: false, senderName: '', avatar: '' });
      return undefined;
    }

    // On activation: just run (state will have been reset while offscreen).
    clearAllTimeouts();
    runSequence();
    return () => clearAllTimeouts();
  }, [runSequence, isActive]);

  // Reset only after the demo is fully offscreen, so the user never sees a refresh.
  useEffect(() => {
    if (isInView) {
      if (inactiveResetTimerRef.current) {
        clearTimeout(inactiveResetTimerRef.current);
        inactiveResetTimerRef.current = null;
      }
      return undefined;
    }

    if (inactiveResetTimerRef.current) clearTimeout(inactiveResetTimerRef.current);
    inactiveResetTimerRef.current = setTimeout(() => {
      const ratio = latestRatioRef.current;
      const isIntersecting = latestIntersectingRef.current;
      // Only reset once the demo is mostly out of view.
      // This avoids stale state when swiping between screens where the element
      // may still be partially intersecting.
      if (isIntersecting && ratio > 0.25) return;

      clearAllTimeouts();
      setMessages([]);
      setInputValue('');
      setTypingState({ isTyping: false, senderName: '', avatar: '' });
      setIsComposerDocked(false);
      setIsDockAnimating(false);
      setIsSendPressed(false);
      prevDockedRef.current = false;
      setSceneOpacity(1);
      setSceneBlur(0);
    }, 350);

    return () => {
      if (inactiveResetTimerRef.current) {
        clearTimeout(inactiveResetTimerRef.current);
        inactiveResetTimerRef.current = null;
      }
    };
  }, [isInView]);

  useEffect(() => {
    if (messages.length > 0 && !isComposerDocked) {
      setIsComposerDocked(true);
    }
  }, [messages.length, isComposerDocked]);

  useEffect(() => {
    const prevDocked = prevDockedRef.current;
    if (!prevDocked && isComposerDocked) {
      setIsDockAnimating(true);
      const id = setTimeout(() => setIsDockAnimating(false), 520);
      prevDockedRef.current = true;
      return () => clearTimeout(id);
    }
    if (!isComposerDocked) {
      prevDockedRef.current = false;
      setIsDockAnimating(false);
    }
    return undefined;
  }, [isComposerDocked]);

  return (
    <div ref={rootRef} className="w-full h-full flex flex-col bg-[#FAF9F6] rounded-[16px] overflow-hidden relative font-sans select-none pointer-events-none">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(0,0,0,0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(0,0,0,0.2);
        }

        .demo-video {
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
          pointer-events: none;
        }

        .demo-video * {
          user-select: none;
          -webkit-user-select: none;
          pointer-events: none;
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-in {
          animation: fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes demo-camera-drift {
          0% {
            transform: translate3d(0px, 0px, 0) scale(1);
          }
          33% {
            transform: translate3d(-1.5px, 1px, 0) scale(1.006);
          }
          66% {
            transform: translate3d(1.5px, -1px, 0) scale(1.004);
          }
          100% {
            transform: translate3d(0px, 0px, 0) scale(1);
          }
        }

        .demo-camera {
          animation: none;
          transform-origin: 50% 35%;
          will-change: transform;
        }

        @keyframes demo-cold-open {
          0% { opacity: 0; transform: translate3d(0, 6px, 0) scale(0.995); }
          100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
        }

        .demo-cold-open {
          animation: demo-cold-open 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
          transform-origin: 50% 40%;
        }

        .demo-scene {
          transition: opacity 260ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity;
        }

        .demo-scene-blur {
          transition:
            opacity 260ms cubic-bezier(0.16, 1, 0.3, 1),
            filter 260ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity, filter;
        }

        .demo-vignette {
          background: radial-gradient(closest-side at 50% 30%, rgba(0,0,0,0) 68%, rgba(0,0,0,0.05) 100%);
          mix-blend-mode: multiply;
          opacity: 0.55;
        }

        .demo-reset-mask {
          background: rgba(250, 249, 246, 1);
          transition: opacity 260ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity;
        }

        @keyframes demo-send-ripple {
          0% { transform: translate(-50%, -50%) scale(0.85); opacity: 0.0; }
          30% { opacity: 0.18; }
          100% { transform: translate(-50%, -50%) scale(1.55); opacity: 0.0; }
        }

        .demo-send-ripple {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 54px;
          height: 54px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.14);
          animation: demo-send-ripple 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
          pointer-events: none;
        }

        .demo-composer-glow {
          box-shadow:
            0 0 0 1px rgba(0,0,0,0.04),
            0 10px 22px rgba(0,0,0,0.045);
        }

        @keyframes demo-send-press {
          0% { transform: scale(1); }
          50% { transform: scale(0.92); }
          100% { transform: scale(1); }
        }

        .demo-send-press {
          animation: demo-send-press 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes demo-highlight-wipe {
          0% { background-size: 0% 100%; }
          100% { background-size: 100% 100%; }
        }

        .demo-highlight {
          background-image:
            linear-gradient(90deg, rgba(254, 243, 199, 0.0) 0%, rgba(254, 243, 199, 0.6) 10%, rgba(254, 243, 199, 0.6) 90%, rgba(254, 243, 199, 0.0) 100%),
            repeating-linear-gradient(0deg, rgba(120, 53, 15, 0.06) 0px, rgba(120, 53, 15, 0.06) 1px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 4px);
          background-repeat: no-repeat;
          background-size: 0% 100%, 100% 100%;
          background-position: 0 80%, 0 80%;
          animation: demo-highlight-wipe 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: 260ms;
        }

        @keyframes demo-caret-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }

        .demo-caret {
          display: inline-block;
          width: 1.5px;
          height: 1.15em;
          background: rgba(15, 23, 42, 0.75);
          border-radius: 1px;
          margin-left: 1px;
          transform: translateY(2px);
          animation: demo-caret-blink 1s step-end infinite;
        }

        @keyframes demo-row-enter {
          0% { opacity: 0; transform: translate3d(0, 6px, 0); }
          100% { opacity: 1; transform: translate3d(0, 0, 0); }
        }

        @keyframes demo-bubble-enter {
          0% {
            opacity: 0;
            transform: translate3d(0, 10px, 0) scale(0.985);
            box-shadow: rgba(0, 0, 0, 0.015) 0px 1px 2px;
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
            box-shadow: rgba(0, 0, 0, 0.045) 0px 2px 10px;
          }
        }

        .demo-row-enter {
          animation: demo-row-enter 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: transform, opacity;
        }

        .demo-bubble-enter {
          animation: demo-bubble-enter 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: 70ms;
          will-change: transform, opacity, box-shadow;
        }

        @keyframes demo-dock-bounce {
          0% { transform: translate3d(0, 0, 0); }
          55% { transform: translate3d(0, 3px, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }

        .demo-dock-bounce {
          animation: demo-dock-bounce 440ms cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: transform;
        }
      `}</style>

      <div className={`demo-video demo-camera absolute inset-0 ${isColdOpen ? 'demo-cold-open' : ''}`}>
        <div className="demo-vignette pointer-events-none absolute inset-0 z-30" />
        <div className="relative z-10 h-full flex flex-col">
          <div
            ref={containerRef}
            className="demo-scene demo-scene-blur flex-1 overflow-y-auto p-4 scroll-smooth custom-scrollbar min-h-0"
            style={{ opacity: sceneOpacity, filter: `blur(${sceneBlur}px)` }}
          >
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}

            {typingState.isTyping && (
              <div className="w-full flex mb-5 px-0 justify-start animate-in">
                <div className="flex flex-col max-w-[85%]">
                  <div className="flex items-center gap-2 mb-1">
                    {typingState.senderName === 'phraze' ? (
                      <div className="w-[18px] h-[18px] rounded-full bg-[rgb(100,116,139)] border border-[rgb(71,85,105)] flex items-center justify-center text-white text-[10px] font-bold">
                        P
                      </div>
                    ) : (
                      <img src={typingState.avatar} alt={typingState.senderName} className="w-[18px] h-[18px] rounded-full object-cover" />
                    )}
                    <span className="text-[0.8rem] font-[500] text-[rgb(85,85,85)]">{typingState.senderName}</span>
                  </div>
                  <div className="bg-white border border-[rgba(15,23,42,0.06)] px-4 py-2.5 rounded-[2rem] rounded-bl-[6px] flex items-center gap-1 w-fit shadow-sm">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {isComposerDocked ? <div className="h-[148px]" /> : null}
          </div>

          <div
            className={`absolute left-0 right-0 bg-[#FAF9F6] p-4 z-20 transition-[top,bottom,transform] duration-440 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isComposerDocked ? 'bottom-0 pt-2' : 'top-1/2 -translate-y-1/2 pt-0'
            }`}
          >
            <div
              className={`bg-white border border-gray-200 rounded-[26px] p-4 shadow-sm flex flex-col gap-3 ${
                inputValue.length > 0 ? 'demo-composer-glow' : ''
              } ${isDockAnimating ? 'demo-dock-bounce' : ''}`}
            >
              <div className="relative w-full">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 text-[15px] max-h-[128px] bg-transparent font-sans text-gray-800 whitespace-pre-wrap"
                  style={{ overflow: 'hidden' }}
                >
                  {inputValue}
                  {showComposerCaret ? <span className="demo-caret" /> : null}
                </div>
                <textarea
                  ref={textareaRef}
                  readOnly
                  value={inputValue}
                  placeholder="How can I help you today?"
                  className="w-full border-none outline-none resize-none text-[15px] max-h-[128px] bg-transparent font-sans text-transparent placeholder-gray-400"
                  rows={1}
                  style={{ height: '24px', caretColor: 'transparent' }}
                />
              </div>
              <div className="flex justify-between items-center">
                <div className="flex gap-4">
                  <button className="text-gray-400 hover:text-gray-600 transition-colors" type="button">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                  </button>
                  <button className="text-gray-400 hover:text-gray-600 transition-colors" type="button">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                      <line x1="12" y1="19" x2="12" y2="23"></line>
                      <line x1="8" y1="23" x2="16" y2="23"></line>
                    </svg>
                  </button>
                  <button className="text-gray-400 hover:text-gray-600 transition-colors" type="button">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                      <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                  </button>
                </div>

                <button
                  type="button"
                  className={`
                    relative w-[32px] h-[32px] rounded-full flex items-center justify-center transition-all duration-200
                    ${inputValue.length > 0 ? 'bg-black text-white' : 'bg-gray-200 text-gray-500'}
                    ${isSendPressed ? 'demo-send-press' : ''}
                  `}
                >
                  {isSendPressed ? <span aria-hidden="true" className="demo-send-ripple" /> : null}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(SecondPageChatDemo);
