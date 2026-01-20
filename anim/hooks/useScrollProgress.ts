import { useState, useEffect, RefObject } from 'react';

export const useScrollProgress = (containerRef: RefObject<HTMLElement>, scrollHeightVh: number) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;

      const { top } = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // Calculate total scrollable height in pixels based on vh unit passed
      const totalScrollHeight = windowHeight * (scrollHeightVh / 100);
      
      // Calculate how far we've scrolled into the section
      // When top is 0, we are at start. As we scroll down, top becomes negative.
      const scrollDistance = -top;
      
      // Calculate effective scrollable distance (total height - one viewport height)
      // We want the animation to finish exactly when the bottom of the sticky container hits the bottom of parent
      const effectiveScrollDistance = totalScrollHeight - windowHeight;

      if (effectiveScrollDistance <= 0) {
          setProgress(0);
          return;
      }

      const rawProgress = scrollDistance / effectiveScrollDistance;
      const clampedProgress = Math.min(Math.max(rawProgress, 0), 1);

      setProgress(clampedProgress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => window.removeEventListener('scroll', handleScroll);
  }, [containerRef, scrollHeightVh]);

  return progress;
};
