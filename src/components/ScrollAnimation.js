import { useEffect } from 'react';

export function useScrollAnimation() {
  useEffect(() => {
    const handleScroll = () => {
      // Select all sections except the first features section
      const sections = document.querySelectorAll('.features-section:not(:first-of-type), .features-section:not(:first-of-type) .feature-card-openai, .demo-window img');
      
      sections.forEach((section) => {
        const sectionTop = section.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;
        
        // Check if element is in viewport
        if (sectionTop < windowHeight * 0.85) {
          section.classList.add('is-visible');
        } else {
          // Remove class when scrolling back up
          section.classList.remove('is-visible');
        }
      });
    };

    // Initial check
    handleScroll();
    
    // Add scroll event listener
    window.addEventListener('scroll', handleScroll);
    
    // Cleanup
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
}

export default useScrollAnimation; 