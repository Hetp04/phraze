import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, Sparkles, PenLine, ChevronDown, ChevronRight, X, Bold, Italic, 
  Palette, Image as ImageIcon, Save, Plus, Paperclip, ShieldCheck, 
  Copy, Info, Check, Users, Tag, FileText, Search, Wrench, BarChart3, PieChart, TrendingUp, Send, Bot, Hexagon
} from 'lucide-react';
import Header from './Header';

// --- VISUAL COMPONENTS ---

const ChatVisual = () => {
  // Start with empty messages to satisfy "User types first"
  const [messages, setMessages] = useState<{id: number, role: 'user' | 'ai', text: React.ReactNode}[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Infinite Animation Loop
  useEffect(() => {
    let mounted = true;
    
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    const script = async () => {
       while(mounted) {
           // 1. Reset State
           setMessages([]); 
           setInputValue("");
           setIsTyping(false);
           await wait(1500);

           // 2. User Types First
           const text1 = "Summarize the feedback on the checkout flow.";
           for (let i = 0; i <= text1.length; i++) {
               if(!mounted) return;
               setInputValue(text1.slice(0, i));
               await wait(30 + Math.random() * 30);
           }
           await wait(500);
           
           // 3. User Sends
           if(!mounted) return;
           setInputValue("");
           setMessages(prev => [...prev, { id: 1, role: 'user', text: text1 }]);

           // 4. AI Thinking
           await wait(600);
           if(!mounted) return;
           setIsTyping(true);
           await wait(1800);
           
           // 5. AI Response
           if(!mounted) return;
           setIsTyping(false);
           
           const aiResponse1 = "I've scanned 12 sessions. Users find the credit card field confusing. 40% abandoned cart there.";
           setMessages(prev => [...prev, { id: 2, role: 'ai', text: "" }]);
           
           for (let i = 0; i <= aiResponse1.length; i++) {
               if (!mounted) return;
               setMessages(prev => prev.map(m => m.id === 2 ? { ...m, text: aiResponse1.slice(0, i) } : m));
               await wait(15);
           }
           
           // --- Interaction 2 ---
           await wait(2500);
           
           // 6. User Types again
           const text2 = "Add a tag for 'UX Issue' to those clips.";
           for (let i = 0; i <= text2.length; i++) {
               if(!mounted) return;
               setInputValue(text2.slice(0, i));
               await wait(30 + Math.random() * 30);
           }
           await wait(500);

           // 7. User Sends
           if(!mounted) return;
           setInputValue("");
           setMessages(prev => [...prev, { id: 3, role: 'user', text: text2 }]);

           // 8. AI Thinking
           await wait(600);
           if(!mounted) return;
           setIsTyping(true);
           await wait(1500);

           // 9. AI Response
           if(!mounted) return;
           setIsTyping(false);
           
           const aiResponse2 = "Done. I've tagged 8 clips with 'UX Issue' and generated a report.";
           setMessages(prev => [...prev, { id: 4, role: 'ai', text: "" }]);

           for (let i = 0; i <= aiResponse2.length; i++) {
               if (!mounted) return;
               setMessages(prev => prev.map(m => m.id === 4 ? { ...m, text: aiResponse2.slice(0, i) } : m));
               await wait(15);
           }

           // --- 10. Highlight Interaction ---
           await wait(800);
           if(!mounted) return;

           // Update message 2 with highlighted text
           setMessages(prev => prev.map(m => {
               if (m.id === 2) {
                   return {
                       ...m,
                       text: (
                           <span>
                               I've scanned 12 sessions.{" "}
                               <span className="relative inline-block">
                                   <span className="relative z-10 text-slate-800 font-medium">Users find the credit card field confusing</span>
                                   <span className="absolute inset-0 bg-[#fef08a] -rotate-1 origin-left scale-x-0 animate-highlight"></span>
                               </span>
                               . 40% abandoned cart there.
                           </span>
                       )
                   };
               }
               return m;
           }));

           // Wait before restart
           await wait(5000);
       }
    }
    
    script();
    return () => { mounted = false; };
  }, []);

  return (
      <div className="relative group w-full flex justify-center md:justify-end">
        
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-[440px] relative overflow-hidden flex flex-col h-[420px]">
           {/* Header */}
           <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 bg-white z-10">
              <div className="flex items-center gap-2">
                 <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57] border border-[#E0443E]/50" />
                 <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E] border border-[#D89E24]/50" />
                 <div className="w-2.5 h-2.5 rounded-full bg-[#28C840] border border-[#1AAB29]/50" />
              </div>
              <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider flex items-center gap-1.5">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 Phraze AI
              </div>
           </div>

           {/* Messages Area */}
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
                  <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-[fadeIn_0.3s_ease-out]`}>
                      {msg.role === 'ai' ? (
                          <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                              <Sparkles className="w-3.5 h-3.5 text-white" />
                          </div>
                      ) : (
                          <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&h=64&fit=crop&crop=faces" alt="User" className="w-8 h-8 rounded-full border-2 border-white shadow-sm shrink-0 mt-0.5" />
                      )}
                      
                      <div className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm max-w-[85%] ${
                          msg.role === 'ai' 
                          ? 'bg-gray-50 text-slate-600 border border-gray-100 rounded-tl-none' 
                          : 'bg-teal-50 text-teal-800 border border-teal-100 rounded-tr-none'
                      }`}>
                          {msg.text}
                      </div>
                  </div>
              ))}
              
              {isTyping && (
                  <div className="flex gap-3 animate-[fadeIn_0.3s_ease-out]">
                      <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                          <Sparkles className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="bg-gray-50 px-4 py-3.5 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm">
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                     </div>
                  </div>
              )}
           </div>

           {/* Input Area */}
           <div className="px-5 py-4 border-t border-gray-50 bg-white z-10">
              <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 flex items-center justify-between">
                  <div className="text-xs text-gray-600 pl-1 w-full font-medium truncate min-h-[1.2em] flex items-center">
                    {inputValue}
                    {!inputValue && <span className="text-gray-400 font-normal">Type a message...</span>}
                    {inputValue && <span className="animate-pulse inline-block w-[1.5px] h-3.5 bg-slate-900 ml-0.5" />}
                  </div>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-sm transition-colors ${inputValue ? 'bg-slate-900 text-white' : 'bg-white border border-gray-200 text-gray-300'}`}>
                      <ArrowRight className="w-3.5 h-3.5" />
                  </div>
              </div>
           </div>
        </div>
      </div>
  )
}

const AnnotateVisual = () => (
    <div className="relative group w-full max-w-[500px] flex items-center md:items-start justify-center md:justify-start pl-0 md:pl-10 py-10">
        
        {/* Floating User Card (Background) */}
        <div className="absolute top-[-20px] right-[20px] md:right-[-20px] z-20 w-[260px] animate-[fadeIn_0.5s_ease-out_0.2s] transform -rotate-3 hover:rotate-0 transition-transform duration-500">
            <div className="bg-white rounded-xl shadow-[0_20px_40px_-12px_rgba(0,0,0,0.12)] border border-gray-100 p-4 flex flex-col gap-4">
                {/* Card Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=faces" className="w-8 h-8 rounded-full object-cover border border-gray-100" alt="Avatar" />
                        <span className="text-xs text-slate-600 font-medium truncate max-w-[130px]">patelhet4002@gmail.com</span>
                    </div>
                    <button className="text-gray-300 hover:text-gray-500 transition-colors bg-gray-50 rounded-md p-0.5"><X className="w-3 h-3" /></button>
                </div>

                {/* Status Dot */}
                <div>
                    <div className="w-3 h-3 rounded-full bg-red-300 shadow-sm border border-red-100"></div>
                </div>

                {/* Labels */}
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

                {/* Footer Actions */}
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

        {/* Main Add Annotations Card (Foreground) */}
        <div className="bg-white rounded-xl shadow-2xl border border-gray-100 w-full max-w-[360px] overflow-hidden text-left transform md:rotate-2 hover:rotate-0 transition-transform duration-500 relative z-10 mt-6">
            
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
                <div className="flex items-center gap-2 text-slate-600 font-medium text-sm">
                    <PenLine className="w-4 h-4 text-gray-400" />
                    <span>Add Annotations</span>
                </div>
                <div className="w-3 h-3 rounded-full bg-red-300 border border-red-100"></div>
            </div>

            <div className="p-4 space-y-5 bg-white">
                {/* Selected Text Section */}
                <div>
                    <div className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Selected text:</div>
                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-[13px] text-slate-600 italic leading-relaxed text-left">
                        hrase! "IH" could stand for a few things, like "I Hate" or "Ice Hockey," but without more context, it's hard to say for sure. Could you please provide more information...
                    </div>
                </div>

                {/* Labels Section */}
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

                {/* Annotation Section */}
                <div>
                    <div className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Annotation:</div>
                    
                    {/* Tabs */}
                    <div className="flex gap-2 mb-2">
                        <button className="px-4 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-slate-700 border border-gray-200 shadow-inner">Text</button>
                        <button className="px-4 py-1.5 rounded-md text-xs font-medium bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 shadow-sm">Canvas</button>
                    </div>

                    {/* Toolbar */}
                    <div className="flex gap-1.5 mb-2">
                        <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-slate-500 hover:bg-gray-50 transition-colors"><Bold className="w-3.5 h-3.5" /></button>
                        <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-slate-500 hover:bg-gray-50 transition-colors"><Italic className="w-3.5 h-3.5" /></button>
                        <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-slate-500 hover:bg-gray-50 transition-colors"><Palette className="w-3.5 h-3.5" /></button>
                        <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-slate-500 hover:bg-gray-50 transition-colors"><ImageIcon className="w-3.5 h-3.5" /></button>
                    </div>

                    {/* Textarea */}
                    <div className="relative">
                        <textarea 
                            className="w-full p-3 border border-gray-200 rounded-lg text-sm min-h-[80px] text-slate-600 placeholder:text-gray-300 resize-none focus:outline-none focus:ring-1 focus:ring-gray-300 shadow-inner bg-white"
                            placeholder="Share your insights, questions, or observations"
                        ></textarea>
                    </div>
                </div>

                {/* Footer Button */}
                <button className="w-full py-2.5 bg-white border border-gray-200 rounded-lg text-slate-600 text-sm font-medium shadow-sm hover:bg-gray-50 hover:shadow-md transition-all flex items-center justify-center gap-2 group/btn">
                    <Save className="w-4 h-4 text-slate-400 group-hover/btn:text-slate-600" />
                    Add Annotations
                </button>
            </div>
        </div>
    </div>
);

const CollaborateVisual = () => {
    const [animationState, setAnimationState] = useState<'modal' | 'transition' | 'result'>('modal');
    const [emailInput, setEmailInput] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    
    // Animation Loop
    useEffect(() => {
        let mounted = true;
        
        const runAnimation = async () => {
            while(mounted) {
                // Reset
                setAnimationState('modal');
                setEmailInput("");
                setShowDropdown(false);
                
                await new Promise(r => setTimeout(r, 2000));
                
                // Type email
                const targetEmail = "alex";
                for (let i = 0; i < targetEmail.length; i++) {
                     if(!mounted) return;
                     setEmailInput(targetEmail.slice(0, i+1));
                     await new Promise(r => setTimeout(r, 150));
                }
                
                // Show Dropdown
                if(!mounted) return;
                setShowDropdown(true);
                await new Promise(r => setTimeout(r, 1200));
                
                // Select user
                if(!mounted) return;
                setEmailInput("alex@design.co"); 
                setShowDropdown(false);
                await new Promise(r => setTimeout(r, 800));

                // Click Invite (Transition triggers)
                if(!mounted) return;
                setAnimationState('transition');
                await new Promise(r => setTimeout(r, 600)); // Fade out time
                
                // Show Result
                if(!mounted) return;
                setAnimationState('result');
                
                // Hold Result
                await new Promise(r => setTimeout(r, 6000));
            }
        };
        runAnimation();
        return () => { mounted = false; };
    }, []);

    return (
        <div className="relative w-full max-w-[500px] h-[360px] flex items-center justify-center">
            
            {/* --- SCENE 1: Share Modal --- */}
            <div className={`absolute top-4 z-20 transition-all duration-500 ease-in-out ${animationState === 'modal' ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-4 pointer-events-none'}`}>
                 <div className="bg-white rounded-xl shadow-2xl border border-gray-100 w-[380px] overflow-hidden">
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-800 text-sm">Share Project: Writing</h3>
                        <X className="w-4 h-4 text-gray-300 cursor-pointer" />
                    </div>

                    <div className="p-5">
                         <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                            Invite your team to collaborate. Secure access is granted instantly via invite code.
                         </p>

                         {/* Invite Code */}
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

                         {/* Email Input */}
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
                                    {/* Dropdown */}
                                    {showDropdown && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                            {[
                                                { name: "Alex Rivera", email: "alex@design.co", img: "https://i.pravatar.cc/100?img=53" },
                                                { name: "Alexandra B.", email: "alex.b@corp.io", img: "https://i.pravatar.cc/100?img=44" }
                                            ].map((user, i) => (
                                                <div key={i} className="flex items-center gap-3 px-3 py-2 hover:bg-teal-50 cursor-pointer group transition-colors first:bg-gray-50">
                                                    <img src={user.img} className="w-6 h-6 rounded-full" alt="" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-medium text-slate-700 group-hover:text-teal-800">{user.name}</div>
                                                        <div className="text-[10px] text-gray-400 truncate">{user.email}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                 </div>
                                 <button className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors shadow-sm ${emailInput.includes('@') ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-gray-100 text-gray-400'}`}>
                                    Invite
                                 </button>
                             </div>
                         </div>
                    </div>

                    <div className="bg-gray-50/50 p-4 border-t border-gray-50 mt-1">
                        <div className="flex gap-3 items-start p-3 bg-white border border-gray-100 rounded-lg">
                            <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                            <div className="text-[11px] text-slate-500 leading-snug">
                                <span className="font-semibold text-slate-700">How it works:</span> Share the invite code with your team. They can enter it in the "Shared Projects" tab to join.
                            </div>
                        </div>
                    </div>
                 </div>
            </div>

            {/* --- SCENE 2: Result (Team Cards) --- */}
            <div className={`relative w-full h-full transition-all duration-700 ease-out ${animationState === 'result' ? 'opacity-100 scale-100 blur-0' : 'opacity-0 scale-95 blur-sm'}`}>
                
                {/* Main Card - Chat/Team */}
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
                        {[1,2,3].map(i => (
                            <div key={i} className="w-10 h-10 rounded-full border-[3px] border-white bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm">
                                <img 
                                    src={`https://i.pravatar.cc/100?img=${i + 10}`} 
                                    alt={`User ${i}`}
                                    className="w-full h-full rounded-full object-cover"
                                />
                            </div>
                        ))}
                        {/* New User Animation */}
                        <div className="w-10 h-10 rounded-full border-[3px] border-white bg-teal-100 flex items-center justify-center shadow-sm relative z-10 animate-in zoom-in duration-500">
                             <img src="https://i.pravatar.cc/100?img=53" className="w-full h-full rounded-full object-cover" alt="New User" />
                             <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                             </div>
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-xl p-3 flex gap-3 items-start border border-gray-100 shadow-sm">
                        <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">S</div>
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

                {/* RBAC Card */}
                <div className="absolute right-0 top-0 md:-right-6 bg-white rounded-xl shadow-[0_20px_40px_-12px_rgba(0,0,0,0.15)] border border-gray-100 w-[240px] p-4 z-20 transform rotate-2">
                    <div className="flex items-center justify-between mb-4 border-b border-gray-50 pb-3">
                        <span className="text-xs font-semibold text-slate-700">Manage Access</span>
                        <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">You</div>
                                <span className="text-xs font-medium text-slate-600">Admin</span>
                            </div>
                            <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">Owner</span>
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
                        
                        {/* New User Added */}
                        <div className="flex items-center justify-between animate-in slide-in-from-left-2 duration-500 fade-in fill-mode-forwards">
                            <div className="flex items-center gap-2">
                                <img src="https://i.pravatar.cc/100?img=53" className="w-6 h-6 rounded-full ring-2 ring-emerald-100" alt="Alex" />
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

const AnalyticsVisual = () => (
    <div className="w-full h-full flex items-center justify-center p-6 relative">
        {/* Background Decorative Elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] bg-gradient-to-br from-teal-50/40 to-indigo-50/40 rounded-full blur-3xl -z-10" />

        {/* Main Card */}
        <div className="bg-white w-full max-w-[340px] rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] border border-gray-100 p-6 relative z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-slate-700">
                         <BarChart3 className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-slate-800 text-sm">Annotation Statistics</span>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400 rotate-180" />
            </div>

            {/* Sub Header */}
            <div className="flex items-center justify-between mb-4">
                 <span className="text-xs font-semibold text-slate-500">Quantity</span>
                 <ChevronDown className="w-3.5 h-3.5 text-gray-400 rotate-180" />
            </div>

            {/* Chart Area */}
            <div className="relative h-32 w-full mb-6">
                <svg viewBox="0 0 300 100" className="w-full h-full overflow-visible">
                    <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#64748b" stopOpacity="0.1" />
                            <stop offset="100%" stopColor="#64748b" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    
                    {/* Area */}
                    <path 
                        d="M0,80 C40,80 60,30 100,30 S180,60 220,50 S260,20 300,20 L300,100 L0,100 Z" 
                        fill="url(#chartGradient)" 
                    />
                    
                    {/* Line */}
                    <path 
                        d="M0,80 C40,80 60,30 100,30 S180,60 220,50 S260,20 300,20" 
                        fill="none" 
                        stroke="#475569" 
                        strokeWidth="1.5" 
                        strokeLinecap="round"
                        className="animate-[draw_1.5s_ease-out_forwards]"
                    />
                </svg>
                
                {/* X-Axis Labels */}
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
            
             {/* Breakdown List */}
             <div className="border-t border-gray-50 pt-4 space-y-3">
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
        </div>
    </div>
);

const ToolItem = ({ icon: Icon, label, subLabel }: { icon: any, label: string, subLabel: string }) => (
  <div className="flex flex-col items-center text-center group cursor-pointer">
      <div className="w-[68px] h-[68px] bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)] flex items-center justify-center mb-3 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:border-gray-200">
          <Icon className="w-7 h-7 text-slate-800 stroke-[1.5]" />
      </div>
      <h3 className="font-bold text-slate-900 text-[13px] mb-0.5">{label}</h3>
      <p className="text-[11px] text-slate-400 font-medium">{subLabel}</p>
  </div>
);

const ToolsSection = () => {
  return (
    <div className="w-full max-w-[1400px] mx-auto pt-16 pb-32 px-6 md:px-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        
        {/* Left Card - White Theme - Analytics Visual */}
        <div className="flex flex-col">
           <h2 className="text-3xl font-serif font-bold text-slate-900 mb-4">Analyze your data</h2>
           <p className="text-slate-500 text-lg leading-relaxed font-light mb-8 max-w-md">
             Visualize trends and uncover hidden patterns in your conversations with powerful analytics tools.
           </p>
           
           <div className="bg-white rounded-[32px] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.06)] border border-gray-100 h-[400px] flex items-center justify-center relative overflow-hidden">
               <AnalyticsVisual />
           </div>
        </div>

        {/* Right Card - Cream Theme - Tools Grid */}
        <div className="flex flex-col">
           <h2 className="text-3xl font-serif font-bold text-slate-900 mb-4">Annotate your chats</h2>
           <p className="text-slate-500 text-lg leading-relaxed font-light mb-8 max-w-md">
             Highlight, code, and take notes directly in conversations so insights are always captured, organized, and never lost.
           </p>
           
           <div className="bg-[#FAF9F6] rounded-[32px] border border-[#EBE9E4] p-12 h-[400px] flex items-center justify-center relative overflow-hidden">
               {/* Inner Card - White */}
               <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-8 w-full max-w-sm">
                   <div className="flex items-center gap-2 mb-8">
                       <Wrench className="w-4 h-4 text-slate-700" />
                       <span className="font-semibold text-slate-700 text-sm">Tools</span>
                   </div>
                   <div className="grid grid-cols-4 gap-2">
                       <ToolItem icon={Tag} label="Labels" subLabel="Active" />
                       <ToolItem icon={FileText} label="Notes" subLabel="Synced" />
                       <ToolItem icon={Users} label="Collaboration" subLabel="Is live" />
                       <ToolItem icon={Search} label="Search" subLabel="Annotations" />
                   </div>
               </div>
           </div>
        </div>

      </div>
    </div>
  );
};

const faqs = [
  {
    question: "What is Phraze?",
    answer: "Phraze is a collaborative workspace and living notebook for every AI conversation. It helps you highlight, annotate, and organize text from any webpage or LLM conversation."
  },
  {
    question: "How does Phraze work?",
    answer: "Phraze uses intelligent highlighting and annotation to transform AI conversations. You can add labels, codes, and notes to individual messages, making it easy to organize discussions and capture insights as they happen."
  },
  {
    question: "What makes Phraze different from other tools?",
    answer: "Unlike traditional tools that require exporting transcripts and switching platforms, Phraze keeps everything in context. It turns raw dialogue into organized, actionable material while maintaining the conversation flow."
  },
  {
    question: "Can I collaborate with my team?",
    answer: "Yes! Phraze is built for teams working with conversational data. Multiple collaborators can work in the same thread without leaving the chat, making it perfect for researchers and development teams."
  },
  {
    question: "How do I get started with Phraze?",
    answer: "Getting started is easy! Simply sign up for an account, install the Chrome extension if you want web highlighting, and start organizing your AI conversations with our intuitive annotation tools."
  },
  {
    question: "What types of annotations can I create?",
    answer: "Phraze supports custom labels, codes, and detailed notes. You can categorize conversations, highlight important insights, and create a structured knowledge base from your AI interactions."
  },
  {
    question: "Is my data secure with Phraze?",
    answer: "Absolutely. We prioritize data security and privacy. All your conversations and annotations are encrypted and stored securely. You have full control over your data and can export or delete it at any time."
  },
  {
    question: "Can I export my annotated conversations?",
    answer: "Yes! Phraze allows you to export your organized conversations in multiple formats. You can share insights with your team, create reports, or integrate the data with other tools in your workflow."
  }
];

const FAQItem: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-4 flex items-start justify-between text-left group"
      >
        <span className={`text-[15px] font-serif text-slate-800 transition-colors ${isOpen ? 'text-teal-700' : ''}`}>
          {question}
        </span>
        <span className={`ml-4 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}>
           <Plus className={`w-4 h-4 ${isOpen ? 'text-teal-600' : 'text-slate-400'}`} />
        </span>
      </button>
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-48 opacity-100 mb-4' : 'max-h-0 opacity-0'}`}
      >
        <p className="text-slate-500 leading-relaxed pr-8 font-light text-sm">
          {answer}
        </p>
      </div>
    </div>
  );
};

const FAQSection = () => {
  return (
    <div className="w-full max-w-6xl mx-auto pt-24 pb-32">
        <h2 className="text-3xl font-serif font-bold text-slate-900 mb-16 text-center">Frequently asked questions</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
            {/* Left: FAQs */}
            <div>
                 <h3 className="text-xl font-serif font-semibold text-slate-800 mb-6">Common Questions</h3>
                 <div className="space-y-0">
                    {faqs.map((faq, index) => (
                      <FAQItem key={index} question={faq.question} answer={faq.answer} />
                    ))}
                 </div>
            </div>

            {/* Right: Contact Form */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sticky top-24 overflow-hidden">
                 <div className="h-1.5 w-full bg-teal-600"></div> {/* Accent line */}
                 <div className="p-8">
                     <div className="mb-6 relative">
                         {/* Friendly Stencil Mascot */}
                         <div className="flex items-center justify-between mb-2">
                             <h3 className="text-xl font-serif font-semibold text-slate-800">Need more support?</h3>
                             <div className="relative group/mascot cursor-pointer">
                                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center transform rotate-3 group-hover/mascot:rotate-12 transition-all duration-300 shadow-md border-2 border-slate-800">
                                     <Bot className="w-7 h-7 text-white" strokeWidth={2} />
                                </div>
                                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full animate-pulse"></div>
                             </div>
                         </div>
                         <p className="text-slate-500 text-sm leading-relaxed">Can't find what you're looking for? Get in touch with our team.</p>
                     </div>
                     
                     <form className="space-y-3">
                         <div>
                            <label className="text-xs font-semibold text-slate-700 mb-1 block">Your name</label>
                            <input type="text" className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/10 placeholder:text-gray-300 transition-all" placeholder="John Doe" />
                         </div>
                         <div>
                            <label className="text-xs font-semibold text-slate-700 mb-1 block">Your email</label>
                            <input type="email" className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/10 placeholder:text-gray-300 transition-all" placeholder="john@company.com" />
                         </div>
                         <div>
                            <label className="text-xs font-semibold text-slate-700 mb-1 block">Subject</label>
                            <input type="text" className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/10 placeholder:text-gray-300 transition-all" placeholder="How can we help?" />
                         </div>
                         <div>
                            <label className="text-xs font-semibold text-slate-700 mb-1 block">Message</label>
                            <textarea className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/10 placeholder:text-gray-300 min-h-[100px] resize-none transition-all" placeholder="Tell us more about your inquiry..."></textarea>
                         </div>
                         <button className="w-full bg-slate-900 text-white py-3 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 mt-2">
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

const CTASection = () => {
  return (
    <div className="w-full bg-white relative pt-48 pb-24 overflow-hidden border-t border-gray-50">
      
      {/* The Gradient - Strong Arc from Top */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px]"
            style={{ 
                background: 'radial-gradient(ellipse at 50% 0%, #22d3ee 0%, #67e8f9 25%, #cffafe 50%, rgba(255,255,255,0) 80%)',
                transform: 'translateX(-50%)',
                filter: 'blur(30px)',
                opacity: 0.8
            }}
          />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center px-6 mb-32">
        <h2 className="text-5xl md:text-7xl font-serif text-slate-900 mb-8 tracking-tight leading-[1.1]">
          Accelerate your growth <br/> with a live demo.
        </h2>
        <button className="bg-[#1a1a1a] text-white px-8 py-4 rounded-xl font-medium text-sm hover:bg-black transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 duration-300 inline-flex items-center gap-2">
          Talk to us
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      
      {/* Footer Area */}
      <div className="max-w-[1400px] mx-auto px-6 relative z-10">
         <div className="flex justify-center border-t border-gray-100 pt-16">
            
            {/* Links Columns - Centered */}
            <div className="flex flex-wrap justify-center gap-16 lg:gap-32">
                <div className="flex flex-col gap-4 text-center md:text-left">
                    <h4 className="font-bold text-slate-900 text-sm">Company</h4>
                    <ul className="space-y-3 text-sm text-slate-500 font-medium">
                        <li><a href="#" className="hover:text-slate-900 transition-colors">About</a></li>
                        <li><a href="#" className="hover:text-slate-900 transition-colors">Contact</a></li>
                    </ul>
                </div>

                <div className="flex flex-col gap-4 text-center md:text-left">
                    <h4 className="font-bold text-slate-900 text-sm">Product</h4>
                    <ul className="space-y-3 text-sm text-slate-500 font-medium">
                        <li><a href="#" className="hover:text-slate-900 transition-colors">Features</a></li>
                    </ul>
                </div>

                <div className="flex flex-col gap-4 text-center md:text-left">
                    <h4 className="font-bold text-slate-900 text-sm">Legal</h4>
                    <ul className="space-y-3 text-sm text-slate-500 font-medium">
                        <li><a href="#" className="hover:text-slate-900 transition-colors">Privacy Policy</a></li>
                        <li><a href="#" className="hover:text-slate-900 transition-colors">Terms of Service</a></li>
                        <li><a href="#" className="hover:text-slate-900 transition-colors">Cookie Policy</a></li>
                    </ul>
                </div>
            </div>

         </div>
         
         <div className="mt-16 pt-8 border-t border-gray-50 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-medium pb-8">
            <p>© 2024 Phraze AI Inc. All rights reserved.</p>
            <div className="flex gap-6">
                <a href="#" className="hover:text-slate-600 transition-colors">Twitter</a>
                <a href="#" className="hover:text-slate-600 transition-colors">LinkedIn</a>
                <a href="#" className="hover:text-slate-600 transition-colors">GitHub</a>
            </div>
         </div>
      </div>
    </div>
  );
};

const StepSection = ({ number, title, description, visual, reversed }: { number: string, title: string, description: string, visual: React.ReactNode, reversed?: boolean }) => {
  return (
    <div className={`flex flex-col ${reversed ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12 lg:gap-24 mb-32 last:mb-0`}>
        <div className="flex-1 w-full text-center lg:text-left">
             <span className="text-teal-600 font-bold font-mono text-sm tracking-wider mb-4 block">{number}</span>
             <h3 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-6 leading-tight max-w-lg mx-auto lg:mx-0">{title}</h3>
             <p className="text-lg text-slate-500 font-light leading-relaxed max-w-md mx-auto lg:mx-0">{description}</p>
        </div>
        <div className="flex-1 w-full flex justify-center lg:block">
            {visual}
        </div>
    </div>
  );
};

const Hero: React.FC = () => {
  return (
    <div className="w-full flex flex-col items-center relative overflow-hidden bg-[#fcfcfc]">
      <Header />
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
          to { opacity: 1; transform: translate(0, 0); }
        }
        @keyframes draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes growWidth {
            from { width: 0; opacity: 1; }
            to { opacity: 1; }
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
      `}</style>
      
      {/* HOW IT WORKS SECTION */}
      <div className="w-full bg-white py-24 relative z-10">
        <div className="max-w-6xl mx-auto px-6">
            
            <StepSection 
                number="01"
                title="Chat with Phraze AI"
                description="Experience natural, context-aware conversations. Ask complex questions, generate content, and explore ideas with an AI that understands your goals."
                visual={<ChatVisual />}
            />

            <StepSection 
                number="02"
                title="Annotate Your Insights"
                description="Don't let good ideas get lost in the scroll. Highlight key moments, attach custom labels, and add notes to structure your qualitative data instantly."
                visual={<AnnotateVisual />}
                reversed
            />

            <StepSection 
                number="03"
                title="Collaborate & Share"
                description="Turn individual chats into team knowledge. Invite colleagues to view, comment, assign role-based permissions (Owner, Editor, Viewer), and build upon your annotated conversations in a shared workspace."
                visual={<CollaborateVisual />}
            />
            
            {/* New Tools Section added underneath */}
            <ToolsSection />

            {/* FAQ Section */}
            <FAQSection />

        </div>
      </div>
      
      {/* Footer & CTA Section */}
      <CTASection />
    </div>
  );
};

export default Hero;