import React from 'react';

export const FilmGrain: React.FC = () => {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden opacity-30 mix-blend-multiply">
      <svg className="h-full w-full">
        <filter id="noiseFilter">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="3"
            stitchTiles="stitch"
          />
          {/* Lower opacity/contrast for light mode grain to avoid looking dirty */}
          <feComponentTransfer>
             <feFuncA type="linear" slope="0.5" />
          </feComponentTransfer>
        </filter>
        <rect width="100%" height="100%" filter="url(#noiseFilter)" />
      </svg>
    </div>
  );
};