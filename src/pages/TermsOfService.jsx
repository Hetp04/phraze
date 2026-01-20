import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

export default function TermsOfService() {
  const [activeSection, setActiveSection] = useState('introduction');
  const sectionsRef = useRef({});

  // Define the sections for the contents panel
  const sections = [
    { id: 'introduction', title: 'Introduction' },
    { id: 'definitions', title: '1. Definitions' },
    { id: 'use-of-service', title: '2. Accounts & Access' },
    { id: 'privacy-and-data', title: '3. Customer Content & Data' },
    { id: 'third-party-services', title: '4. Third-Party Services' },
    { id: 'confidentiality', title: '5. Confidentiality' },
    { id: 'intellectual-property', title: '6. Intellectual Property' },
    { id: 'indemnification', title: '7. Indemnification' },
    { id: 'limitation-of-liability', title: '8. Limitation of Liability' },
    { id: 'termination', title: '9. Termination' },
    { id: 'changes-to-terms', title: '10. Changes to these Terms' },
    { id: 'contact', title: '11. Contact Us' }
  ];

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 150; // Increased offset for better detection

      // Find which section is currently in view
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

    // Call once on mount to set initial active section
    handleScroll();
    
    // Add scroll event listener with throttling for better performance
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
    <main className="terms-page" style={{ 
      background: 'linear-gradient(180deg, #ffffff 0%, #ffffff 88%, #b8c4d0 100%)',
      minHeight: '100vh'
    }}>
      {/* Hero Section */}
      <section className="terms-hero" style={{ paddingTop: '120px', background: 'transparent' }}>
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
            fontFamily: '"Inter", "Inter Fallback", sans-serif',
            textAlign: 'left'
          }}>Terms of Service</h1>
          <p style={{
            fontSize: '18px',
            color: '#6b7280',
            margin: '0',
            maxWidth: '600px',
            textAlign: 'left',
            lineHeight: '1.6',
            fontFamily: '"Inter", "Inter Fallback", sans-serif'
          }}>
            Please read these terms carefully before using our service
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
          {/* Left Side - Terms Content */}
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
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>Introduction</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                Phraze is a research-driven project developed by the Human-Centered Computing Group in affiliation with Western University (London, Ontario, Canada). The Services are provided for academic, research, and educational purposes, and are governed by these Terms of Service (this "Agreement"). By accessing or using Phraze (the "Services"), you agree to these Terms.
              </p>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                Phraze is an initiative under Western University's research activities and is subject to applicable university policies. The Services may incorporate third-party technologies, including large language models, governed in part by external terms such as the Google Terms of Service. By using Phraze, you acknowledge and agree to comply with such third-party terms where applicable.
              </p>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                If you use the Services on behalf of an institution or organization, you represent that you are authorized to bind that entity. If you do not agree to this Agreement, do not use the Services.
              </p>
            </div>

            {/* Definitions */}
            <div ref={el => sectionsRef.current.definitions = el} id="definitions" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>1. Definitions</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                <strong>"Account"</strong> means your registered profile to access the Services.
              </p>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                <strong>"Annotations"</strong> means labels, codes, notes, highlights, and metadata you or your users apply to messages or conversations within the Services.
              </p>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                <strong>"Customer Content"</strong> means any data, text, files, media, annotations, or other materials you submit to or generate in the Services (including conversation transcripts and any uploads).
              </p>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                <strong>"Documentation"</strong> means the user guides and help materials we make available.
              </p>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                <strong>"Free Services"</strong> means free access we make available at no charge.
              </p>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                <strong>"Output"</strong> means AI-generated responses, summaries, or other results produced by AI features in the Services.
              </p>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                <strong>"Platform"</strong> means our web app, extension(s), and related systems used to provide the Services.
              </p>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                <strong>"Usage Data"</strong> means de-identified technical, diagnostic, and usage information about how the Services perform and are used.
              </p>
            </div>

            {/* Accounts & Access */}
            <div ref={el => sectionsRef.current['use-of-service'] = el} id="use-of-service" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>2. Accounts & Access</h2>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1rem',
                marginTop: '1.5rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>2.1 Eligibility.</h3>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                You must be at least the age of majority in your jurisdiction and capable of forming a binding contract. If you are under 18, you may not use the Services.
              </p>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1rem',
                marginTop: '1.5rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>2.2 Your Account.</h3>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                Keep your login credentials confidential. You are responsible for all activities under your Account. Notify us promptly of any unauthorized access.
              </p>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1rem',
                marginTop: '1.5rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>2.3 Authorized Users.</h3>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                If you grant others access (e.g., teammates or collaborators), you are responsible for their compliance with this Agreement.
              </p>
            </div>



            {/* Customer Content & Data */}
            <div ref={el => sectionsRef.current['privacy-and-data'] = el} id="privacy-and-data" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>3. Customer Content & Data</h2>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1rem',
                marginTop: '1.5rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>4.1 Ownership.</h3>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                You retain all rights to Customer Content. We do not claim ownership of your data.
              </p>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1rem',
                marginTop: '1.5rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>4.2 License to Operate.</h3>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                You grant us a worldwide, non-exclusive license to host, process, transmit, display, and adapt Customer Content as reasonably necessary to provide, secure, and improve the Services.
              </p>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1rem',
                marginTop: '1.5rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>4.3 AI Features.</h3>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                For research and free accounts, you grant us permission to use Customer Content (in de-identified form) to train and improve AI models.
              </p>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                For enterprise or formal research agreements, we do not use Customer Content for training without explicit written consent.
              </p>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1rem',
                marginTop: '1.5rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>4.4 Usage Data.</h3>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                We may collect and use Usage Data to improve the Services, provided it does not identify you or your users.
              </p>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1rem',
                marginTop: '1.5rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>4.5 Security.</h3>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                We implement commercially reasonable measures to protect Customer Content, though no system is completely secure.
              </p>
            </div>



            {/* Third-Party Services */}
            <div ref={el => sectionsRef.current['third-party-services'] = el} id="third-party-services" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>4. Third-Party Services</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                The Services may interoperate with third-party products you choose to enable. We do not control or endorse these and are not responsible for their availability, security, or content. You are responsible for complying with applicable third-party terms, including the Google Terms of Service where relevant.
              </p>
            </div>

            {/* Confidentiality */}
            <div ref={el => sectionsRef.current['confidentiality'] = el} id="confidentiality" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>5. Confidentiality</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                Each party may access the other's non-public information marked confidential or that should reasonably be considered confidential. The receiving party will protect it using reasonable care and use it only to perform under this Agreement.
              </p>
            </div>

            {/* Intellectual Property */}
            <div ref={el => sectionsRef.current['intellectual-property'] = el} id="intellectual-property" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>6. Intellectual Property</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                We own the Services, software, Documentation, and related IP, including our domain name (phrazeapp.ai) which we purchased and own through Namecheap.com. Our service is deployed through GitHub Pages infrastructure. Except for the limited rights granted here, no rights are transferred. Feedback you provide may be used by us freely without attribution.
              </p>
            </div>



            {/* Indemnification */}
            <div ref={el => sectionsRef.current['indemnification'] = el} id="indemnification" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>7. Indemnification</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                You agree to indemnify and hold Phraze, the Human-Centered Computing Group, and Western University harmless from claims, damages, or losses arising from (a) Customer Content; (b) your use of the Services in violation of this Agreement or law; or (c) your use of third-party services.
              </p>
            </div>

            {/* Limitation of Liability */}
            <div ref={el => sectionsRef.current['limitation-of-liability'] = el} id="limitation-of-liability" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>8. Limitation of Liability</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                To the fullest extent permitted by law, Phraze, Western University, and affiliated researchers will not be liable for indirect, incidental, or consequential damages, or for lost data or goodwill arising out of or related to the use of the Services.
              </p>
            </div>

            {/* Termination */}
            <div ref={el => sectionsRef.current.termination = el} id="termination" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>9. Termination</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                We may suspend or terminate your access immediately if you breach this Agreement, use the Services unlawfully, or pose a security risk. You may stop using the Services at any time. Upon termination, your rights end and we may delete your data after a reasonable period.
              </p>
            </div>



            {/* Changes to these Terms */}
            <div ref={el => sectionsRef.current['changes-to-terms'] = el} id="changes-to-terms" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>10. Changes to these Terms</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                We may update these Terms from time to time. Changes take effect upon posting. Continued use of the Services after changes indicates acceptance.
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
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>11. Contact Us</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
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
              fontFamily: '"Inter", "Inter Fallback", sans-serif',
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
                      fontFamily: '"Inter", "Inter Fallback", sans-serif',
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
            fontFamily: '"Inter", "Inter Fallback", sans-serif',
            transition: 'color 0.2s ease'
          }}>Terms of Service</Link>
          <Link to="/privacy" style={{
            fontSize: '14px',
            color: '#6b7280',
            textDecoration: 'none',
            fontFamily: '"Inter", "Inter Fallback", sans-serif',
            transition: 'color 0.2s ease'
          }}>Privacy Policy</Link>
          <Link to="/cookies" style={{
            fontSize: '14px',
            color: '#6b7280',
            textDecoration: 'none',
            fontFamily: '"Inter", "Inter Fallback", sans-serif',
            transition: 'color 0.2s ease'
          }}>Cookie Policy</Link>
          <Link to="/contact" style={{
            fontSize: '14px',
            color: '#6b7280',
            textDecoration: 'none',
            fontFamily: '"Inter", "Inter Fallback", sans-serif',
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
