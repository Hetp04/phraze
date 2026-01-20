import React from 'react';

interface FloatingIconProps {
  icon: React.ReactNode;
  rotate?: string;
  className?: string;
  delay?: number;
}

const FloatingIcon: React.FC<FloatingIconProps> = ({ icon, rotate = '0deg', className = '', delay = 0 }) => {
  return (
    <div 
        className={`bg-white p-5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-50 flex items-center justify-center transform hover:scale-105 transition-transform duration-300 cursor-default ${className}`}
        style={{ 
            transform: `rotate(${rotate})`,
            animation: `float 6s ease-in-out infinite`,
            animationDelay: `${delay}s`
        }}
    >
        <style>
        {`
          @keyframes float {
            0% { transform: rotate(${rotate}) translateY(0px); }
            50% { transform: rotate(${rotate}) translateY(-10px); }
            100% { transform: rotate(${rotate}) translateY(0px); }
          }
        `}
      </style>
      {icon}
    </div>
  );
};

export default FloatingIcon;