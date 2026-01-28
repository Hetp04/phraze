import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage, ScriptItem } from '../types';

const MAYA_AVATAR = "https://i.pravatar.cc/150?u=maya";
const ALEX_AVATAR = "https://i.pravatar.cc/150?u=alex";

const SCRIPT: ScriptItem[] = [
  {
    senderType: 'user',
    senderName: 'Jin Liner',
    avatar: MAYA_AVATAR,
    text: "Hey! I'm trying to build a machine learning model for image recognition. Any tips on getting started?",
    highlights: ["Hey! I'm trying to build a machine learning model for image recognition. Any tips on getting started?"]
  },
  {
    senderType: 'ai',
    senderName: 'phraze',
    avatar: 'phraze',
    text: "Great question! For image recognition, I'd recommend starting with TensorFlow or PyTorch. Begin with pre-trained models like ResNet or VGG, then fine-tune them on your specific dataset.",
    highlights: ['TensorFlow or PyTorch', 'ResNet or VGG']
  },
  {
    senderType: 'user',
    senderName: 'Alex Chen',
    avatar: ALEX_AVATAR,
    text: "I started with TensorFlow too! The transfer learning approach saved me weeks of training time.",
    highlights: ['TensorFlow']
  },
  {
    senderType: 'ai',
    senderName: 'phraze',
    avatar: 'phraze',
    text: "That's excellent! Transfer learning is indeed a game-changer. Since you're working with medical images, I'd recommend looking into architectures specifically designed for medical imaging like DenseNet or EfficientNet. They handle the fine details in medical scans much better than general-purpose models.",
    highlights: ['DenseNet or EfficientNet']
  },
  {
    senderType: 'user',
    senderName: 'Jin Liner',
    avatar: MAYA_AVATAR,
    text: "@alex I'm working with medical images. Should I use a different architecture?",
    highlights: ["@alex I'm working with medical images. Should I use a different architecture?"]
  },
  {
    senderType: 'user',
    senderName: 'Alex Chen',
    avatar: ALEX_AVATAR,
    text: "@Jin For medical images, definitely consider U-Net or ResNet-50. They're proven performers in medical imaging. Also, make sure to use proper data augmentation techniques since medical datasets are often smaller.",
    highlights: ['U-Net or ResNet-50']
  }
];

const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const ChatBubble: React.FC<{ message: ChatMessage; isNew?: boolean }> = ({ message, isNew }) => {
  // Logic: Jin Liner is "Me" (Right), everyone else is "Them" (Left)
  const isMe = message.senderName === 'Jin Liner';
  const isPhraze = message.senderName === 'phraze';
  
  const renderText = () => {
    if (!message.highlights || message.highlights.length === 0) {
      return message.text;
    }
    const patterns = [...message.highlights].sort((a, b) => b.length - a.length).map(escapeRegExp);
    if (patterns.length === 0) return message.text;

    const regex = new RegExp(`(${patterns.join('|')})`, 'g');
    const parts = message.text.split(regex);

    return parts.map((part, index) => {
      const isHighlight = message.highlights?.includes(part);
      if (isHighlight) {
        return (
          <span 
            key={index} 
            style={{ backgroundColor: 'rgba(254, 243, 199, 0.6)' }}
            className="rounded px-0.5 box-decoration-clone"
          >
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
        w-full flex mb-3 px-4 ${isMe ? 'justify-end' : 'justify-start'}
        animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out fill-mode-backwards
      `}
    >
      <div className="flex flex-col max-w-[85%]">
        <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
          {!isPhraze ? (
            <img src={message.avatar} alt={message.senderName} className="w-[18px] h-[18px] rounded-full object-cover" />
          ) : (
            <div className="w-[18px] h-[18px] rounded-full bg-[rgb(100,116,139)] border border-[rgb(71,85,105)] flex items-center justify-center text-white text-[10px] font-bold">
              P
            </div>
          )}
          <span className="text-[0.8rem] font-[500] text-[rgb(85,85,85)]">
            {message.senderName}
          </span>
        </div>

        <div
          className={`
            text-[0.9rem] leading-[1.4] relative z-10 bg-white pt-3 pb-5 px-5 shadow-sm
            ${isMe 
              ? 'rounded-[2rem] rounded-br-[5px]' 
              : 'rounded-lg'
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

interface TypingState {
  isTyping: boolean;
  senderName: string;
  avatar: string;
}

const SecondPageChatDemo: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [typingState, setTypingState] = useState<TypingState>({ isTyping: false, senderName: '', avatar: '' });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  
  // Track previous height to only scroll when size changes significantly
  const prevTextareaHeight = useRef<number>(24);

  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  const addTimeout = (fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timeoutsRef.current.push(id);
    return id;
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (containerRef.current) {
      const { scrollHeight, clientHeight } = containerRef.current;
      // Only scroll if there is scrollable content
      if (scrollHeight > clientHeight) {
          containerRef.current.scrollTo({
            top: scrollHeight - clientHeight,
            behavior
          });
      }
    }
  };

  // Scroll on message updates or typing indicator
  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages.length, typingState.isTyping]);

  // Handle Textarea Auto-Resize & Layout Scroll
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height momentarily to get correct scrollHeight
      textareaRef.current.style.height = 'auto';
      const newHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${newHeight}px`;

      // If the input grew significantly, scroll chat to keep bottom visible
      if (Math.abs(newHeight - prevTextareaHeight.current) > 5) {
        scrollToBottom('smooth');
        prevTextareaHeight.current = newHeight;
      }
    }
  }, [inputValue]);

  const runSequence = useCallback(async () => {
    let currentMsgIndex = 0;

    const processNextMessage = async () => {
      if (currentMsgIndex >= SCRIPT.length) {
        addTimeout(() => {
          setMessages([]);
          setInputValue('');
          runSequence();
        }, 4000); // Longer pause at end
        return;
      }

      const scriptItem = SCRIPT[currentMsgIndex];
      const isLocalUser = scriptItem.senderName === 'Jin Liner';

      if (isLocalUser) {
        // LOCAL USER (Jin): Type in bottom box -> Send
        
        let delayStart = currentMsgIndex === 0 ? 800 : 1200;

        addTimeout(() => {
            const textToType = scriptItem.text;
            let charIndex = 0;

            const typeChar = () => {
                if (charIndex <= textToType.length) {
                    setInputValue(textToType.slice(0, charIndex));
                    charIndex++;
                    // Slower, more natural typing speed (30-60ms)
                    const speed = Math.random() * 30 + 30; 
                    addTimeout(typeChar, speed);
                } else {
                    addTimeout(() => {
                        setMessages(prev => [...prev, { ...scriptItem, id: Date.now().toString() }]);
                        setInputValue('');
                        currentMsgIndex++;
                        processNextMessage();
                    }, 500); // Pause before sending
                }
            };
            typeChar();
        }, delayStart);

      } else {
        // REMOTE ENTITY (Phraze OR Alex): Show Typing Indicator -> Stream
        
        const thinkingTime = Math.random() * 800 + (scriptItem.senderName === 'Alex Chen' ? 1500 : 1000);

        setTypingState({
          isTyping: true,
          senderName: scriptItem.senderName,
          avatar: scriptItem.avatar
        });

        addTimeout(() => {
          setTypingState({ isTyping: false, senderName: '', avatar: '' });
          
          const newMessageId = Date.now().toString();
          const fullText = scriptItem.text;
          
          setMessages(prev => [
            ...prev, 
            { ...scriptItem, id: newMessageId, text: '' }
          ]);

          // Use a faster, constant speed for "streaming" (15ms)
          // We can batch updates slightly if needed, but 15ms is usually fine for smooth look
          let charIndex = 0;
          const streamChar = () => {
            if (charIndex <= fullText.length) {
              setMessages(prev => {
                  const lastMsg = prev[prev.length - 1];
                  // Optimization: Only update if it's the last message we are streaming
                  if (lastMsg && lastMsg.id === newMessageId) {
                      const newText = fullText.slice(0, charIndex);
                      // Avoid React state update if text hasn't changed (unlikely here but good practice)
                      if (lastMsg.text === newText) return prev;
                      
                      const newMsgs = [...prev];
                      newMsgs[newMsgs.length - 1] = { ...lastMsg, text: newText };
                      return newMsgs;
                  }
                  return prev;
              });
              
              // Auto-scroll during streaming to keep tracking
              if (charIndex % 5 === 0) { // Throttle scroll calls
                 scrollToBottom('smooth');
              }

              charIndex++;
              addTimeout(streamChar, 12); // Fast, consistent stream
            } else {
              currentMsgIndex++;
              processNextMessage();
            }
          };
          streamChar();
        }, thinkingTime);
      }
    };

    processNextMessage();
  }, []);

  useEffect(() => {
    runSequence();
    return () => clearAllTimeouts();
  }, [runSequence]);

  return (
    <div className="w-full h-full flex flex-col bg-[rgb(247,247,247)] rounded-[16px] overflow-hidden relative font-sans">
      {/* Inline styles for custom scrollbar and animations */}
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
      `}</style>
      
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 pb-4 scroll-smooth custom-scrollbar min-h-0"
      >
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}

        {typingState.isTyping && (
          <div className="w-full flex mb-3 px-4 justify-start animate-in">
            <div className="flex flex-col max-w-[85%]">
               <div className="flex items-center gap-2 mb-1">
                  {typingState.senderName === 'phraze' ? (
                    <div className="w-[18px] h-[18px] rounded-full bg-[rgb(100,116,139)] border border-[rgb(71,85,105)] flex items-center justify-center text-white text-[10px] font-bold">
                      P
                    </div>
                  ) : (
                    <img src={typingState.avatar} alt={typingState.senderName} className="w-[18px] h-[18px] rounded-full object-cover" />
                  )}
                  <span className="text-[0.8rem] font-[500] text-[rgb(85,85,85)]">
                    {typingState.senderName}
                  </span>
                </div>
                <div className="bg-white px-4 py-3 rounded-lg flex items-center gap-1 w-fit shadow-sm">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
            </div>
          </div>
        )}
        
        {/* Spacer to push content up above the absolute positioned input. Increased for taller footer. */}
        <div className="h-[140px]" /> 
      </div>

      {/* Bottom Composer */}
      <div className="absolute bottom-0 left-0 right-0 bg-[rgb(247,247,247)] p-4 pt-0 z-20">
        <div className="bg-white border border-gray-200 rounded-[26px] p-4 shadow-sm flex flex-col gap-3 transition-all duration-200">
          <textarea
            ref={textareaRef}
            readOnly
            value={inputValue}
            placeholder="How can I help you today?"
            className="w-full border-none outline-none resize-none text-[15px] max-h-[128px] bg-transparent font-sans text-gray-800 placeholder-gray-400"
            rows={1}
            style={{ height: '24px' }}
          />
          <div className="flex justify-between items-center">
             <div className="flex gap-4">
                {/* Gallery Icon */}
                <button className="text-gray-400 hover:text-gray-600 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                </button>
                {/* Mic Icon */}
                <button className="text-gray-400 hover:text-gray-600 transition-colors">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                     <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                     <line x1="12" y1="19" x2="12" y2="23"></line>
                     <line x1="8" y1="23" x2="16" y2="23"></line>
                   </svg>
                </button>
                {/* Camera Icon */}
                <button className="text-gray-400 hover:text-gray-600 transition-colors">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                     <circle cx="12" cy="13" r="4"></circle>
                   </svg>
                </button>
             </div>

             {/* Send Button */}
             <button
                className={`
                  w-[32px] h-[32px] rounded-full flex items-center justify-center transition-all duration-200
                  ${inputValue.length > 0 ? 'bg-black text-white' : 'bg-gray-200 text-gray-500'}
                `}
              >
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
  );
};

export default SecondPageChatDemo;