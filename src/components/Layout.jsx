import { useEffect, useState, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { Navbar as KarumiNavbar } from '../../karumi/components/Navbar';

export default function Layout({ children, currentProject, onProjectChange }) {
  const location = useLocation();
  const [navbarHeight, setNavbarHeight] = useState(0);
  const isHomeRoute = location.pathname === '/';

  useLayoutEffect(() => {
    if (isHomeRoute) {
      setNavbarHeight(80);
      return;
    }

    const el = document.querySelector('.navbar');
    if (!el) {
      setNavbarHeight(0);
      return;
    }

    const update = () => setNavbarHeight(el.offsetHeight || 0);
    update();

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, [location.pathname]);

  useEffect(() => {
    // Use a single, optimized scroll operation
    if (location.pathname === '/demonstration') {
      // For demonstration page, ensure we're at the top
      window.scrollTo({ top: 0, behavior: 'auto' });
      document.body.setAttribute('data-page', 'demonstration');
    } else {
      // For other pages, use smooth scroll to top
      window.scrollTo({ top: 0, behavior: 'auto' });
      document.body.removeAttribute('data-page');
    }

    // Safety: ensure no global scroll-lock styles linger
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';

    // Batch DOM operations to reduce reflows
    requestAnimationFrame(() => {
      const mainElement = document.querySelector('main');
      const navbarElement = document.querySelector('.navbar');
      
      if (mainElement) {
        mainElement.classList.add('reveal');
        mainElement.style.paddingTop = '20px';
      }
      if (navbarElement) {
        navbarElement.classList.add('reveal');
      }
    });
  }, [location]);

  // Hide navbar on specific pages
  const shouldHideNavbar = location.pathname === '/' ||
                          location.pathname === '/demo' ||
                          location.pathname === '/demonstration' || 
                          location.pathname === '/auth' || 
                          location.pathname === '/access-denied' ||
                          location.pathname === '/onboarding';

  return (
    <>
      {/* Only show navbar if NOT on demonstration, auth, access-denied, or onboarding pages */}
      {!shouldHideNavbar && (
        <Navbar currentProject={currentProject} onProjectChange={onProjectChange}/>
      )}
      {isHomeRoute && <KarumiNavbar />}
      <div style={{ paddingTop: isHomeRoute ? 0 : navbarHeight }}>
        {children}
      </div>
      {/* <Footer /> */}
    </>
  );
}