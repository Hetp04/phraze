import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

export default function CookiePolicy() {
  const [activeSection, setActiveSection] = useState('introduction');
  const sectionsRef = useRef({});

  // Define the sections for the contents panel
  const sections = [
    { id: 'introduction', title: 'Introduction' },
    { id: 'what-are-cookies', title: '1. What Are Cookies' },
    { id: 'how-we-use-cookies', title: '2. How We Use Cookies' },
    { id: 'types-of-cookies', title: '3. Types of Cookies' },
    { id: 'third-party-cookies', title: '4. Third-Party Cookies' },
    { id: 'managing-cookies', title: '5. Managing Cookies' },
    { id: 'contact', title: '6. Contact Us' }
  ];

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 150;

      let currentSection = 'introduction';
      
      for (const section of sections) {
        const element = sectionsRef.current[section.id];
        if (element) {
          const rect = element.getBoundingClientRect();
          const elementTop = rect.top + window.scrollY;
          const elementBottom = elementTop + rect.height;

          if (scrollPosition >= elementTop && scrollPosition < elementBottom) {
            currentSection = section.id;
            break;
          }
        }
      }
      
      setActiveSection(currentSection);
    };

    handleScroll();
    
    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledScroll);
    return () => window.removeEventListener('scroll', throttledScroll);
  }, []);

  const scrollToSection = (sectionId) => {
    const element = sectionsRef.current[sectionId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <main className="cookie-page" style={{ 
      background: 'linear-gradient(180deg, #ffffff 0%, #ffffff 88%, #b8c4d0 100%)',
      minHeight: '100vh'
    }}>
      {/* Hero Section */}
      <section className="cookie-hero" style={{ paddingTop: '120px', background: 'transparent' }}>
        <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ 
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px'
          }}>
            <p className="small-text" style={{ margin: 0, fontSize: '16px' }}>Phraze</p>
          </div>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: '700',
            color: '#1a1a1a',
            marginBottom: '1rem',
            marginTop: 0,
            fontFamily: '"Glacial Indifference", sans-serif',
            textAlign: 'left'
          }}>Cookie Policy</h1>
          <p style={{
            fontSize: '18px',
            color: '#6b7280',
            margin: '0',
            maxWidth: '600px',
            textAlign: 'left',
            lineHeight: '1.6',
            fontFamily: '"Inter", "Inter Fallback", sans-serif'
          }}>
            Learn about how we use cookies and similar technologies
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section style={{
        padding: '60px 0',
        maxWidth: '1200px',
        margin: '0 auto',
        paddingLeft: '24px',
        paddingRight: '24px'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
          gap: '60px',
          alignItems: 'start'
        }}>
          {/* Left Side - Cookie Content */}
          <div style={{ flex: 1 }}>
            {/* Introduction */}
            <div ref={el => sectionsRef.current.introduction = el} id="introduction" style={{ 
              marginBottom: '60px',
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              backgroundColor: 'transparent'
            }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>Introduction</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>
                This Cookie Policy explains how Phraze uses cookies and similar technologies when you visit our platform. Cookies help us provide you with a better experience and improve our Services.
              </p>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>
                By using our Services, you consent to the use of cookies in accordance with this policy. You can control and manage cookies through your browser settings.
              </p>
            </div>

            {/* What Are Cookies */}
            <div ref={el => sectionsRef.current['what-are-cookies'] = el} id="what-are-cookies" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>1. What Are Cookies</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>
                Cookies are small text files that are stored on your device when you visit a website. They help websites remember information about your visit, such as your preferred language and other settings.
              </p>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>
                Cookies can make your next visit easier and more useful. They help us understand how our Services are used and improve your experience.
              </p>
            </div>

            {/* How We Use Cookies */}
            <div ref={el => sectionsRef.current['how-we-use-cookies'] = el} id="how-we-use-cookies" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>2. How We Use Cookies</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>
                We use cookies for several purposes:
              </p>
              <ul style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                paddingLeft: '2rem',
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>
                <li>Remember your preferences and settings</li>
                <li>Keep you signed in to your account</li>
                <li>Understand how you use our Services</li>
                <li>Improve our platform performance</li>
                <li>Provide personalized features</li>
              </ul>
            </div>

            {/* Types of Cookies */}
            <div ref={el => sectionsRef.current['types-of-cookies'] = el} id="types-of-cookies" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>3. Types of Cookies</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>
                <strong>Essential Cookies:</strong> These are necessary for the website to function properly. They enable basic functions like page navigation and access to secure areas.
              </p>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>
                <strong>Performance Cookies:</strong> These help us understand how visitors interact with our website by collecting information anonymously.
              </p>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>
                <strong>Functionality Cookies:</strong> These allow the website to remember choices you make and provide enhanced features.
              </p>
            </div>

            {/* Third-Party Cookies */}
            <div ref={el => sectionsRef.current['third-party-cookies'] = el} id="third-party-cookies" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>4. Third-Party Cookies</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>
                Some cookies on our platform are set by third-party services that we use, such as:
              </p>
              <ul style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                paddingLeft: '2rem',
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>
                <li>Google Analytics for website analytics</li>
                <li>AI language model services for processing</li>
                <li>Cloud hosting providers for performance</li>
              </ul>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>
                These third-party cookies are subject to their respective privacy policies.
              </p>
            </div>

            {/* Managing Cookies */}
            <div ref={el => sectionsRef.current['managing-cookies'] = el} id="managing-cookies" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>5. Managing Cookies</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>
                You can control and manage cookies in several ways:
              </p>
              <ul style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                paddingLeft: '2rem',
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>
                <li>Browser settings to block or delete cookies</li>
                <li>Browser extensions for cookie management</li>
                <li>Device settings for mobile browsers</li>
              </ul>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>
                Please note that disabling certain cookies may affect the functionality of our Services.
              </p>
            </div>

            {/* Contact Information */}
            <div ref={el => sectionsRef.current.contact = el} id="contact" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>6. Contact Us</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>
                If you have questions about our use of cookies, please contact us:
              </p>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>
                <strong>Phraze — Human-Centered Computing Group</strong><br />
                <strong>Western University</strong><br />
                <strong>London, Ontario, Canada</strong><br />
                <strong>Email:</strong> phrazeai@gmail.com<br />
                <strong>Western Research:</strong> research.comms@uwo.ca
              </p>
            </div>

          </div>

          {/* Right Side - Contents Panel */}
          <div style={{
            backgroundColor: '#fafafa',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid #e5e7eb',
            height: 'fit-content',
            minWidth: '280px'
          }}>
            <h3 style={{
              fontSize: '1.2rem',
              fontWeight: '700',
              color: '#111827',
              marginBottom: '1.25rem',
              marginTop: 0,
              fontFamily: '"Glacial Indifference", sans-serif',
              borderBottom: '2px solid #e5e7eb',
              paddingBottom: '0.75rem'
            }}>Contents</h3>
            <nav>
              {sections.map((section) => (
                <div key={section.id} style={{ marginBottom: '0.5rem' }}>
                  <div
                    onClick={() => scrollToSection(section.id)}
                    style={{
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: activeSection === section.id ? '#111827' : '#6b7280',
                      fontWeight: activeSection === section.id ? '600' : '400',
                      textAlign: 'left',
                      width: '100%',
                      fontFamily: '"Glacial Indifference", sans-serif',
                      transition: 'color 0.2s ease',
                      padding: '0.25rem 0'
                    }}
                  >
                    {section.title}
                  </div>
                </div>
              ))}
            </nav>
          </div>
                    
        </div>
      </section>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        padding: '3rem 0 2rem 0',
        marginTop: '4rem',
        borderTop: '1px solid rgba(0, 0, 0, 0.06)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '2rem',
          marginBottom: '1rem',
          flexWrap: 'wrap'
        }}>
          <Link to="/terms" style={{
            fontSize: '14px',
            color: '#6b7280',
            textDecoration: 'none',
            fontFamily: '"Glacial Indifference", sans-serif',
            transition: 'color 0.2s ease'
          }}>Terms of Service</Link>
          <Link to="/privacy" style={{
            fontSize: '14px',
            color: '#6b7280',
            textDecoration: 'none',
            fontFamily: '"Glacial Indifference", sans-serif',
            transition: 'color 0.2s ease'
          }}>Privacy Policy</Link>
          <Link to="/cookies" style={{
            fontSize: '14px',
            color: '#6b7280',
            textDecoration: 'none',
            fontFamily: '"Glacial Indifference", sans-serif',
            transition: 'color 0.2s ease'
          }}>Cookie Policy</Link>
          <Link to="/contact" style={{
            fontSize: '14px',
            color: '#6b7280',
            textDecoration: 'none',
            fontFamily: '"Glacial Indifference", sans-serif',
            transition: 'color 0.2s ease'
          }}>Contact</Link>
        </div>
        <p style={{
          fontSize: '14px',
          color: '#6b7280',
          margin: '0',
          fontFamily: '"Inter", "Inter Fallback", sans-serif'
        }}>
          © 2025 Phraze. Developed by the Human-Centered Computing Group in affiliation with Western University. All rights reserved.
        </p>
      </div>
    </main>
  );
}
