import React from 'react';
import { MessageSquarePlus, MousePointer2, Users } from 'lucide-react';

export const DashboardPreview: React.FC = () => {
  return (
    <div className="w-full relative">
      {/* 
         Gradient Section Container
      */}
      <div className="relative w-full bg-gradient-to-br from-[#FFF5EC] via-[#FFEFE2] to-[#FFE0D6] py-20 border-y border-gray-200">
         
         {/* Background Shapes */}
         <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-orange-200/30 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-red-200/20 rounded-full blur-[100px]"></div>
         </div>

         {/* Content Container - Locked to Grid */}
         <div className="max-w-[950px] mx-auto px-6 relative">
            
            {/* The Main Mockup */}
            <div className="relative z-10">
                <div className="w-full max-w-[900px] mx-auto bg-white/80 backdrop-blur-xl rounded-xl border border-white shadow-2xl overflow-hidden aspect-[16/10] relative group">
                    
                    {/* Fake Browser UI */}
                    <div className="h-10 bg-white border-b border-gray-100 flex items-center px-4 gap-2">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-400/80"></div>
                            <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
                        </div>
                        <div className="flex-1 text-center">
                            <div className="inline-block px-3 py-1 bg-gray-50 rounded text-[10px] text-gray-400 font-medium tracking-wide">
                                workspace.new/project/atlas
                            </div>
                        </div>
                    </div>

                    {/* Dashboard Interface Mockup */}
                    <div className="p-6 grid grid-cols-12 gap-6 h-full bg-white/50">
                        {/* Sidebar */}
                        <div className="col-span-3 border-r border-gray-100 pr-4 hidden sm:block">
                            <div className="space-y-4">
                                <div className="h-8 w-8 bg-gray-900 rounded-lg mb-8"></div>
                                <div className="space-y-3">
                                    <div className="h-2 w-20 bg-gray-300 rounded-full"></div>
                                    <div className="h-2 w-16 bg-gray-200 rounded-full"></div>
                                    <div className="h-2 w-24 bg-gray-200 rounded-full"></div>
                                </div>
                                <div className="pt-4 border-t border-gray-100 mt-4">
                                    <div className="flex -space-x-2">
                                        <div className="w-6 h-6 rounded-full bg-blue-400 border border-white"></div>
                                        <div className="w-6 h-6 rounded-full bg-green-400 border border-white"></div>
                                        <div className="w-6 h-6 rounded-full bg-orange-400 border border-white"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Main Content */}
                        <div className="col-span-12 sm:col-span-9">
                             <div className="flex justify-between items-center mb-8">
                                <div className="flex items-center gap-3">
                                   <div className="h-6 w-32 bg-gray-800 rounded"></div>
                                   <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">LIVE</span>
                                </div>
                                <div className="h-8 w-24 rounded border border-gray-200 bg-white"></div>
                             </div>

                             <div className="space-y-4">
                                {/* Chat Bubble / Conversation Item */}
                                <div className="flex gap-4 p-4 rounded-lg bg-white border border-gray-100 shadow-sm">
                                    <div className="w-8 h-8 rounded-full bg-purple-100 flex-shrink-0"></div>
                                    <div className="space-y-2 w-full">
                                        <div className="h-2 w-24 bg-gray-200 rounded"></div>
                                        <div className="h-2 w-3/4 bg-gray-200 rounded"></div>
                                        <div className="h-2 w-1/2 bg-gray-200 rounded"></div>
                                    </div>
                                </div>

                                {/* Active Annotation Item */}
                                <div className="relative p-4 rounded-lg border-2 border-orange-200 bg-orange-50/30">
                                    <div className="flex gap-4">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex-shrink-0"></div>
                                        <div className="space-y-2 w-full">
                                            <div className="h-2 w-24 bg-gray-300 rounded"></div>
                                            <div className="h-2 w-full bg-gray-300 rounded"></div>
                                            <div className="h-2 w-5/6 bg-gray-300 rounded"></div>
                                        </div>
                                    </div>
                                    
                                    {/* Cursor & Comment Badge */}
                                    <div className="absolute -right-2 top-1/2 z-20">
                                        <div className="relative">
                                            <MousePointer2 className="w-5 h-5 text-gray-900 fill-black" />
                                            <div className="absolute left-4 top-2 bg-[#F26522] text-white text-[9px] font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap tracking-wide flex items-center gap-1">
                                                <MessageSquarePlus className="w-3 h-3" />
                                                Please expand on this
                                            </div>
                                        </div>
                                    </div>
                                </div>
                             </div>
                        </div>
                    </div>
                </div>

                {/* Overlapping Collaborator Card */}
                <div className="absolute top-[20%] right-0 md:-right-6 translate-x-0 md:translate-x-1/4 z-30 w-64">
                    <div className="bg-white rounded-2xl p-4 shadow-2xl border border-gray-100 transform rotate-[-2deg] hover:rotate-0 transition-transform duration-500">
                        <div className="flex items-center gap-3 mb-3">
                             <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-sm">
                                JD
                             </div>
                             <div>
                                 <div className="text-sm font-bold text-gray-900">John Doe</div>
                                 <div className="text-xs text-gray-500">Product Lead</div>
                             </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 leading-relaxed border border-gray-100">
                            "Great insight here. Let's pull this into the Q3 roadmap workspace."
                        </div>
                    </div>
                </div>

                {/* Decorative Pill */}
                <div className="absolute -bottom-6 left-10 z-30 hidden md:block">
                   <div className="bg-white rounded-full py-2 px-5 shadow-xl border border-gray-100 flex items-center gap-3 transform rotate-2 hover:rotate-0 transition-transform">
                      <div className="bg-blue-100 p-1.5 rounded-full">
                         <Users className="w-4 h-4 text-blue-600 fill-blue-600" />
                      </div>
                      <div>
                          <div className="text-xs font-bold text-gray-900">Real-time Sync</div>
                          <div className="text-[10px] text-gray-500">3 collaborators active</div>
                      </div>
                   </div>
                </div>

            </div>
         </div>
      </div>
    </div>
  );
};