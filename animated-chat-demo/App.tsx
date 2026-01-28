import React from 'react';
import SecondPageChatDemo from './components/SecondPageChatDemo';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      {/* Target Card: AI Assistant Preview */}
      <div className="max-w-2xl w-full h-[450px] bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 flex flex-col">
         {/* Header of the card (simulation) */}
         <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white z-10">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">AI Assistant Preview</h2>
              <p className="text-xs text-gray-500">Real-time collaboration demo</p>
            </div>
            <div className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-medium rounded-full">
              Live Demo
            </div>
         </div>
         
         {/* The Component Content Area */}
         <div className="flex-1 p-3 bg-white relative min-h-0">
            <div className="w-full h-full">
               <SecondPageChatDemo />
            </div>
         </div>
      </div>
    </div>
  );
};

export default App;