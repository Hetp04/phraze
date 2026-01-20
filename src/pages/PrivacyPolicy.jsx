import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  const [activeSection, setActiveSection] = useState('introduction');
  const sectionsRef = useRef({});

  // Define the sections for the contents panel
  const sections = [
    { id: 'introduction', title: 'Introduction' },
    { id: 'data-collection', title: '1. Data Collection' },
    { id: 'data-usage', title: '2. How We Use Your Data' },
    { id: 'data-sharing', title: '3. Data Sharing & Disclosure' },
    { id: 'data-security', title: '4. Data Security' },
    { id: 'data-retention', title: '5. Data Retention' },
    { id: 'your-rights', title: '6. Your Rights' },
    { id: 'cookies', title: '7. Cookies & Tracking' },
    { id: 'third-party', title: '8. Third-Party Services' },
    { id: 'children', title: '9. Children\'s Privacy' },
    { id: 'changes', title: '10. Changes to This Policy' },
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
    <main className="privacy-page" style={{ 
      background: 'linear-gradient(180deg, #ffffff 0%, #ffffff 88%, #b8c4d0 100%)',
      minHeight: '100vh'
    }}>
      {/* Hero Section */}
      <section className="privacy-hero" style={{ paddingTop: '120px', background: 'transparent' }}>
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
          }}>Privacy Policy</h1>
          <p style={{
            fontSize: '18px',
            color: '#6b7280',
            margin: '0',
            maxWidth: '600px',
            textAlign: 'left',
            lineHeight: '1.6',
            fontFamily: '"Inter", "Inter Fallback", sans-serif'
          }}>
            Learn how we protect and handle your personal information
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
          {/* Left Side - Privacy Content */}
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
                This Privacy Policy explains how Phraze, a research-driven project developed by the Human-Centered Computing Group in affiliation with Western University, collects, uses, and protects your personal information when you use our Services.
              </p>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                We are committed to protecting your privacy and ensuring the security of your personal data. This policy outlines our practices regarding data collection, usage, and your rights as a user of our Services.
              </p>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                By using Phraze, you agree to the collection and use of information in accordance with this policy. If you have any questions about this Privacy Policy, please contact us.
              </p>
            </div>

            {/* Data Collection */}
            <div ref={el => sectionsRef.current['data-collection'] = el} id="data-collection" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>1. Data Collection</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                We collect information you provide directly to us, such as when you create an account, use our Services, or contact us for support. This may include:
              </p>
              <ul style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                paddingLeft: '2rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                <li>Account information (name, email address, institution affiliation)</li>
                <li>Content you submit or generate using our Services</li>
                <li>Communications with our support team</li>
                <li>Feedback and survey responses</li>
              </ul>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                We also collect basic technical information necessary for our Services to function, such as session data and authentication tokens. This information is stored securely using Firebase and is only used to maintain your account and provide the Services you request.
              </p>
            </div>

            {/* How We Use Your Data */}
            <div ref={el => sectionsRef.current['data-usage'] = el} id="data-usage" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>2. How We Use Your Data</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                We use the information we collect to:
              </p>
              <ul style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                paddingLeft: '2rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                <li>Provide, maintain, and improve our Services</li>
                <li>Process your requests and account activities</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Conduct research and analysis to improve our Services</li>
                <li>Ensure the security and integrity of our platform</li>
              </ul>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                We do not use your personal data for research, training, or any other purposes beyond providing our Services. Your data is stored securely using Firebase and is only used to maintain your account and provide the functionality you request.
              </p>
            </div>

            {/* Data Sharing & Disclosure */}
            <div ref={el => sectionsRef.current['data-sharing'] = el} id="data-sharing" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>3. Data Sharing & Disclosure</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except in the following circumstances:
              </p>
              <ul style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                paddingLeft: '2rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                <li>With your explicit consent</li>
                <li>To comply with legal obligations or court orders</li>
                <li>To protect our rights, property, or safety</li>
                <li>With service providers who assist in operating our Services</li>
                <li>For research purposes with appropriate safeguards and de-identification</li>
              </ul>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                Any third-party service providers are bound by confidentiality agreements and may only use your data for the specific purposes we authorize.
              </p>
            </div>

            {/* Data Security */}
            <div ref={el => sectionsRef.current['data-security'] = el} id="data-security" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>4. Data Security</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include:
              </p>
              <ul style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                paddingLeft: '2rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                <li>Encryption of data in transit and at rest</li>
                <li>Regular security assessments and updates</li>
                <li>Access controls and authentication measures</li>
                <li>Secure data centers and infrastructure</li>
                <li>Employee training on data protection practices</li>
                <li>Firebase security features and encryption</li>
              </ul>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                We use Firebase for secure data storage and authentication, which provides enterprise-grade security features. While we strive to protect your information, no method of transmission over the internet or electronic storage is 100% secure. We cannot guarantee absolute security but are committed to maintaining the highest standards of data protection.
              </p>
            </div>

            {/* Data Retention */}
            <div ref={el => sectionsRef.current['data-retention'] = el} id="data-retention" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>5. Data Retention</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                We retain your personal information only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. Our retention practices include:
              </p>
              <ul style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                paddingLeft: '2rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                <li>Account data: Retained while your account is active and for a reasonable period after deactivation</li>
                <li>Usage data: Retained for service improvement and security purposes</li>
                <li>Research data: Retained according to research protocols and institutional requirements</li>
                <li>Legal requirements: Retained as required by applicable laws or regulations</li>
              </ul>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                When we no longer need your personal information, we will securely delete or anonymize it in accordance with our data retention policies.
              </p>
            </div>

            {/* Your Rights */}
            <div ref={el => sectionsRef.current['your-rights'] = el} id="your-rights" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>6. Your Rights</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                You have certain rights regarding your personal information, including:
              </p>
              <ul style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                paddingLeft: '2rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
                <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
                <li><strong>Deletion:</strong> Request deletion of your personal information, subject to legal requirements</li>
                <li><strong>Portability:</strong> Request transfer of your data to another service provider</li>
                <li><strong>Restriction:</strong> Request limitation of how we process your information</li>
                <li><strong>Objection:</strong> Object to certain types of processing</li>
              </ul>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                To exercise these rights, please contact us using the information provided at the end of this policy. We will respond to your request within a reasonable timeframe and may require verification of your identity.
              </p>
            </div>

            {/* Cookies & Tracking */}
            <div ref={el => sectionsRef.current.cookies = el} id="cookies" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>7. Cookies & Tracking</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                We use cookies and similar tracking technologies to enhance your experience on our platform. These technologies help us:
              </p>
              <ul style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                paddingLeft: '2rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                <li>Remember your preferences and settings</li>
                <li>Analyze how our Services are used</li>
                <li>Improve performance and functionality</li>
                <li>Provide personalized content and features</li>
                <li>Ensure security and prevent fraud</li>
              </ul>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                You can control cookie settings through your browser preferences. However, disabling certain cookies may affect the functionality of our Services.
              </p>
            </div>

            {/* Third-Party Services */}
            <div ref={el => sectionsRef.current['third-party'] = el} id="third-party" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>8. Third-Party Services</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                Our Services may integrate with third-party services and technologies, including:
              </p>
              <ul style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                paddingLeft: '2rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                <li>Firebase for data storage and authentication</li>
                <li>AI language models and processing services</li>
                <li>Cloud hosting and storage providers</li>
                <li>Analytics and monitoring tools</li>
              </ul>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                These third-party services have their own privacy policies and data handling practices. We encourage you to review their policies to understand how they may collect and use your information.
              </p>
            </div>

            {/* Children's Privacy */}
            <div ref={el => sectionsRef.current.children = el} id="children" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>9. Children's Privacy</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                Our Services are not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.
              </p>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                For users between the ages of 13 and 18, we require parental consent for the collection and processing of personal information. We take additional precautions to protect the privacy of young users.
              </p>
            </div>

            {/* Changes to This Policy */}
            <div ref={el => sectionsRef.current.changes = el} id="changes" style={{ marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>10. Changes to This Policy</h2>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. When we make changes, we will:
              </p>
              <ul style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                paddingLeft: '2rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                <li>Update the "Last Updated" date at the top of this policy</li>
                <li>Notify you of significant changes through our Services or email</li>
                <li>Provide advance notice for material changes when possible</li>
              </ul>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                Your continued use of our Services after any changes to this policy indicates your acceptance of the updated terms. We encourage you to review this policy periodically.
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
                If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
              </p>
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
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.7',
                marginBottom: '1rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                We are committed to addressing your privacy concerns and will respond to your inquiries in a timely manner.
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
