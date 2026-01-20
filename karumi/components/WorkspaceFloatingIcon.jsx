import React from 'react';

export default function WorkspaceFloatingIcon({ icon, rotate = '0deg', className = '', delay = 0 }) {
  return (
    <div
      className={`bg-white p-5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-50 flex items-center justify-center transform hover:scale-105 transition-transform duration-300 cursor-default ${className}`}
      style={{
        transform: `rotate(${rotate})`
      }}
    >
      {icon}
    </div>
  );
}
