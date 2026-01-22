import React from 'react';
import { LiveCollaborationCard } from './components/LiveCollaborationCard';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100 flex items-center justify-center p-8">
      
      {/* Bento Grid Container */}
      <div className="w-full max-w-4xl flex flex-col gap-6">
        
        {/* Row 1: Two equal boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[340px]">
           {/* Card 1: Empty Placeholder */}
           <div className="w-full h-full bg-white rounded-3xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden group">
              <div className="absolute inset-0 bg-gray-50/30"></div>
              {/* Optional Placeholder Content Simulation */}
              <div className="absolute top-6 left-6 w-32 h-6 bg-gray-100 rounded-lg opacity-50"></div>
              <div className="absolute top-16 left-6 right-6 bottom-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200"></div>
           </div>

           {/* Card 2: Empty Placeholder */}
           <div className="w-full h-full bg-white rounded-3xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden group">
              <div className="absolute inset-0 bg-gray-50/30"></div>
              {/* Optional Placeholder Content Simulation */}
              <div className="absolute top-6 left-6 w-32 h-6 bg-gray-100 rounded-lg opacity-50"></div>
              <div className="absolute top-16 left-6 right-6 bottom-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200"></div>
           </div>
        </div>

        {/* Row 2: One wide (2/3), One small (1/3) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[260px]">
           {/* Card 3: Wide Container with Collaboration Animation */}
           <div className="md:col-span-2 w-full h-full">
               <LiveCollaborationCard />
           </div>

           {/* Card 4: Small Placeholder */}
           <div className="w-full h-full bg-white rounded-3xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden">
               <div className="absolute inset-0 bg-gray-50/30"></div>
               <div className="absolute inset-6 rounded-full border-4 border-gray-100 opacity-50"></div>
           </div>
        </div>

      </div>

    </div>
  );
}