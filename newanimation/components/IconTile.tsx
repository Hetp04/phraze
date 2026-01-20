import React from 'react';
import { LucideIcon } from 'lucide-react';

interface IconTileProps {
  icon: LucideIcon;
  color?: string; 
  className?: string;
  style?: React.CSSProperties;
  floatDelay?: number;
}

const IconTile: React.FC<IconTileProps> = ({ icon: Icon, color = "gray", className = "", style, floatDelay = 0 }) => {
  const animClass = floatDelay === 0 ? 'animate-float' : floatDelay === 1 ? 'animate-float-delayed' : 'animate-float-slow';
  
  // New "Card" aesthetic: White background, soft border, colored icon
  const getColors = (c: string) => {
    switch (c) {
      case 'orange': return 'text-orange-600 bg-white border-orange-100 shadow-orange-900/5';
      case 'blue': return 'text-blue-600 bg-white border-blue-100 shadow-blue-900/5';
      case 'purple': return 'text-purple-600 bg-white border-purple-100 shadow-purple-900/5';
      case 'green': return 'text-emerald-600 bg-white border-emerald-100 shadow-emerald-900/5';
      case 'yellow': return 'text-amber-600 bg-white border-amber-100 shadow-amber-900/5';
      case 'pink': return 'text-pink-600 bg-white border-pink-100 shadow-pink-900/5';
      default: return 'text-stone-600 bg-white border-stone-200 shadow-stone-900/5';
    }
  };

  return (
    <div 
      className={`absolute flex items-center justify-center rounded-2xl border shadow-xl ${getColors(color)} ${className}`}
      style={style}
    >
      <div className={animClass}>
        <Icon size={28} strokeWidth={1.5} />
      </div>
    </div>
  );
};

export default IconTile;