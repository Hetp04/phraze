import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Contact() {
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Handle form submission
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    try {
      const response = await fetch('https://formspree.io/f/xdkwvzlk', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        setFormSubmitted(true);
        e.target.reset(); // Clear the form
      } else {
        alert('There was an error submitting the form. Please try again.');
      }
    } catch (error) {
      alert('There was an error submitting the form. Please try again.');
    }
  };

  return (
    <main style={{ 
      background: 'linear-gradient(180deg, #ffffff 0%, #ffffff 95%, #b8c4d0 100%)',
      minHeight: '100vh',
      paddingTop: '100px'
    }}>
      {/* Request a Demo Section */}
      <section style={{
        padding: '60px 0',
        maxWidth: '1200px',
        margin: '0 auto',
        paddingLeft: '20px',
        paddingRight: '20px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{
            fontSize: '28px',
            fontWeight: '600',
            color: '#202123',
            margin: '0 0 8px 0',
            fontFamily: '"Glacial Indifference", sans-serif'
          }}>
            Request a Demo
          </h2>
          <p style={{
            fontSize: '16px',
            color: '#6e6e80',
            margin: '0',
            fontFamily: '"Glacial Indifference", sans-serif'
          }}>
            See how Phraze can transform your LLM development workflow
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
          gap: '48px',
          alignItems: 'start'
        }}>
          {/* Form Column */}
          <div>
            {formSubmitted ? (
              <div style={{
                textAlign: 'center',
                padding: '20px 20px 60px 20px',
                maxWidth: '700px',
                margin: '0 auto'
              }}>
                <div style={{
                  background: '#f8f9fa',
                  border: '1px solid #e9ecef',
                  borderRadius: '12px',
                  padding: '40px',
                  marginBottom: '20px'
                }}>
                  <h3 style={{
                    fontSize: '24px',
                    fontWeight: '600',
                    color: '#000000',
                    margin: '0 0 16px 0',
                    fontFamily: '"Glacial Indifference", sans-serif'
                  }}>
                    Thank you!
                  </h3>
                  <p style={{
                    fontSize: '16px',
                    color: '#6c757d',
                    margin: '0 0 24px 0',
                    fontFamily: '"Glacial Indifference", sans-serif'
                  }}>
                    Your demo request has been submitted successfully. We'll get back to you within 24 hours.
                  </p>
                  <button
                    onClick={() => setFormSubmitted(false)}
                    style={{
                      background: '#000000',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '12px 24px',
                      fontSize: '16px',
                      fontWeight: '500',
                      fontFamily: '"Glacial Indifference", sans-serif',
                      cursor: 'pointer'
                    }}
                  >
                    Submit Another Request
                  </button>
                </div>
              </div>
            ) : (
              <form 
                onSubmit={handleFormSubmit}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '32px 24px',
                  maxWidth: '700px',
                  margin: '0 auto'
                }}>
                {/* First Name Field */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#6e6e80',
                    marginBottom: '8px',
                    fontFamily: '"Glacial Indifference", sans-serif'
                  }}>
                    First name
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    placeholder="Enter your first name"
                    required
                    style={{
                      padding: '12px 16px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontFamily: '"Glacial Indifference", sans-serif',
                      outline: 'none',
                      backgroundColor: '#f9fafb',
                      color: '#202123',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#10a37f';
                      e.target.style.backgroundColor = '#ffffff';
                      e.target.style.boxShadow = '0 0 0 3px rgba(16, 163, 127, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.backgroundColor = '#f9fafb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Last Name Field */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#6e6e80',
                    marginBottom: '8px',
                    fontFamily: '"Glacial Indifference", sans-serif'
                  }}>
                    Last name
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    placeholder="Enter your last name"
                    required
                    style={{
                      padding: '12px 16px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontFamily: '"Glacial Indifference", sans-serif',
                      outline: 'none',
                      backgroundColor: '#f9fafb',
                      color: '#202123',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#10a37f';
                      e.target.style.backgroundColor = '#ffffff';
                      e.target.style.boxShadow = '0 0 0 3px rgba(16, 163, 127, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.backgroundColor = '#f9fafb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Work Email Field */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#6e6e80',
                    marginBottom: '8px',
                    fontFamily: '"Glacial Indifference", sans-serif'
                  }}>
                    Work email
                  </label>
                  <input
                    type="email"
                    name="email"
                    placeholder="Enter your work email"
                    required
                    style={{
                      padding: '12px 16px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontFamily: '"Glacial Indifference", sans-serif',
                      outline: 'none',
                      backgroundColor: '#f9fafb',
                      color: '#202123',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#10a37f';
                      e.target.style.backgroundColor = '#ffffff';
                      e.target.style.boxShadow = '0 0 0 3px rgba(16, 163, 127, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.backgroundColor = '#f9fafb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Job Title Field */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#6e6e80',
                    marginBottom: '8px',
                    fontFamily: '"Glacial Indifference", sans-serif'
                  }}>
                    Job title
                  </label>
                  <input
                    type="text"
                    name="job_title"
                    placeholder="Enter your job title"
                    required
                    style={{
                      padding: '12px 16px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontFamily: '"Glacial Indifference", sans-serif',
                      outline: 'none',
                      backgroundColor: '#f9fafb',
                      color: '#202123',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#10a37f';
                      e.target.style.backgroundColor = '#ffffff';
                      e.target.style.boxShadow = '0 0 0 3px rgba(16, 163, 127, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.backgroundColor = '#f9fafb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Company Name Field */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#6e6e80',
                    marginBottom: '8px',
                    fontFamily: '"Glacial Indifference", sans-serif'
                  }}>
                    Company name (optional)
                  </label>
                  <input
                    type="text"
                    name="company_name"
                    placeholder="Enter your company name"
                    style={{
                      padding: '12px 16px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontFamily: '"Glacial Indifference", sans-serif',
                      outline: 'none',
                      backgroundColor: '#f9fafb',
                      color: '#202123',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#10a37f';
                      e.target.style.backgroundColor = '#ffffff';
                      e.target.style.boxShadow = '0 0 0 3px rgba(16, 163, 127, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.backgroundColor = '#f9fafb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Company Size Field */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#6e6e80',
                    marginBottom: '8px',
                    fontFamily: '"Glacial Indifference", sans-serif'
                  }}>
                    Company size (optional)
                  </label>
                  <select
                    name="company_size"
                    style={{
                      padding: '12px 32px 12px 16px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontFamily: '"Glacial Indifference", sans-serif',
                      outline: 'none',
                      backgroundColor: '#f9fafb',
                      cursor: 'pointer',
                      color: '#6e6e80',
                      transition: 'all 0.2s ease',
                      backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236e6e80\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6,9 12,15 18,9\'%3e%3c/polyline%3e%3c/svg%3e")',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      backgroundSize: '16px',
                      appearance: 'none'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#10a37f';
                      e.target.style.backgroundColor = '#ffffff';
                      e.target.style.boxShadow = '0 0 0 3px rgba(16, 163, 127, 0.1)';
                      e.target.style.color = '#202123';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.backgroundColor = '#f9fafb';
                      e.target.style.boxShadow = 'none';
                      if (e.target.value === '') {
                        e.target.style.color = '#6e6e80';
                      }
                    }}
                    onChange={(e) => {
                      e.target.style.color = '#202123';
                    }}
                  >
                    <option value="" style={{ color: '#6e6e80' }}>Select...</option>
                    <option value="1-10">1-10 employees</option>
                    <option value="11-50">11-50 employees</option>
                    <option value="51-200">51-200 employees</option>
                    <option value="201-500">201-500 employees</option>
                    <option value="501-1000">501-1000 employees</option>
                    <option value="1000+">1000+ employees</option>
                  </select>
                </div>

                {/* Reason for Contact Field - Full Width */}
                <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                  <label style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#6e6e80',
                    marginBottom: '8px',
                    fontFamily: '"Glacial Indifference", sans-serif'
                  }}>
                    Reason for contact
                  </label>
                  <select
                    name="reason_for_contact"
                    required
                    style={{
                      padding: '12px 32px 12px 16px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontFamily: '"Glacial Indifference", sans-serif',
                      outline: 'none',
                      backgroundColor: '#f9fafb',
                      cursor: 'pointer',
                      color: '#6e6e80',
                      transition: 'all 0.2s ease',
                      backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236e6e80\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6,9 12,15 18,9\'%3e%3c/polyline%3e%3c/svg%3e")',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      backgroundSize: '16px',
                      appearance: 'none'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#10a37f';
                      e.target.style.backgroundColor = '#ffffff';
                      e.target.style.boxShadow = '0 0 0 3px rgba(16, 163, 127, 0.1)';
                      e.target.style.color = '#202123';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.backgroundColor = '#f9fafb';
                      e.target.style.boxShadow = 'none';
                      if (e.target.value === '') {
                        e.target.style.color = '#6e6e80';
                      }
                    }}
                    onChange={(e) => {
                      e.target.style.color = '#202123';
                    }}
                  >
                    <option value="" style={{ color: '#6e6e80' }}>Select...</option>
                    <option value="demo">Request a demo</option>
                    <option value="pricing">Pricing information</option>
                    <option value="integration">Integration support</option>
                    <option value="partnership">Partnership inquiry</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Provide More Details Field - Full Width */}
                <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                  <label style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#6e6e80',
                    marginBottom: '8px',
                    fontFamily: '"Glacial Indifference", sans-serif'
                  }}>
                    Provide more details (optional)
                  </label>
                  <textarea
                    name="details"
                    placeholder="How are you looking to use Phraze?"
                    rows={4}
                    style={{
                      padding: '12px 16px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontFamily: '"Glacial Indifference", sans-serif',
                      outline: 'none',
                      backgroundColor: '#f9fafb',
                      resize: 'vertical',
                      minHeight: '100px',
                      color: '#202123',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#10a37f';
                      e.target.style.backgroundColor = '#ffffff';
                      e.target.style.boxShadow = '0 0 0 3px rgba(16, 163, 127, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.backgroundColor = '#f9fafb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Submit Button - Full Width */}
                <div style={{ gridColumn: '1 / -1', marginTop: '16px' }}>
                  <button
                    type="submit"
                    style={{
                      background: 'rgb(40, 40, 40)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 24px',
                      fontSize: '16px',
                      fontWeight: '500',
                      fontFamily: '"Glacial Indifference", sans-serif',
                      cursor: 'pointer',
                      width: '100%',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = 'rgb(30, 30, 30)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'rgb(40, 40, 40)';
                    }}
                  >
                    Request Demo
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Sidebar - Learn More About Phraze */}
          <div style={{
            position: 'sticky',
            top: '100px'
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#6e6e80',
              margin: '0 0 16px 0',
              letterSpacing: '0.01em',
              fontFamily: '"Glacial Indifference", sans-serif'
            }}>
              Learn more about Phraze
            </h3>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginBottom: '24px'
            }}>
              {/* LinkedIn */}
              <a
                href="https://www.linkedin.com/company/phraze"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  textDecoration: 'none',
                  color: '#202123',
                  borderRadius: '6px',
                  transition: 'background-color 0.15s ease',
                  fontFamily: '"Glacial Indifference", sans-serif'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f7f7f8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                  <rect x="2" y="9" width="4" height="12"></rect>
                  <circle cx="4" cy="4" r="2"></circle>
                </svg>
                <span style={{ fontSize: '14px', fontWeight: '400' }}>LinkedIn</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', opacity: 0.4 }}>
                  <path d="M7 17L17 7"></path>
                  <path d="M7 7h10v10"></path>
                </svg>
              </a>

              {/* Medium */}
              <a
                href="https://medium.com/@phraze"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  textDecoration: 'none',
                  color: '#202123',
                  borderRadius: '6px',
                  transition: 'background-color 0.15s ease',
                  fontFamily: '"Glacial Indifference", sans-serif'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f7f7f8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                <span style={{ fontSize: '14px', fontWeight: '400' }}>Medium</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', opacity: 0.4 }}>
                  <path d="M7 17L17 7"></path>
                  <path d="M7 7h10v10"></path>
                </svg>
              </a>

              {/* Product Hunt */}
              <a
                href="https://www.producthunt.com/@phraze"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  textDecoration: 'none',
                  color: '#202123',
                  borderRadius: '6px',
                  transition: 'background-color 0.15s ease',
                  fontFamily: '"Glacial Indifference", sans-serif'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f7f7f8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path>
                  <path d="M9 18h6"></path>
                  <path d="M10 22h4"></path>
                </svg>
                <span style={{ fontSize: '14px', fontWeight: '400' }}>Product Hunt</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', opacity: 0.4 }}>
                  <path d="M7 17L17 7"></path>
                  <path d="M7 7h10v10"></path>
                </svg>
              </a>
            </div>

            {/* Divider */}
            <div style={{
              height: '1px',
              background: '#e5e7eb',
              margin: '24px 0'
            }}></div>

            {/* Quick Links Section */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#6e6e80',
                margin: '0 0 16px 0',
                letterSpacing: '0.01em',
                fontFamily: '"Glacial Indifference", sans-serif'
              }}>
                Quick links
              </h4>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <a
                  href="#"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    textDecoration: 'none',
                    color: '#202123',
                    borderRadius: '6px',
                    transition: 'background-color 0.15s ease',
                    fontFamily: '"Glacial Indifference", sans-serif'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f7f7f8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polygon points="10 8 16 12 10 16 10 8"></polygon>
                  </svg>
                  <span style={{ fontSize: '14px', fontWeight: '400' }}>Try now</span>
                </a>
              </div>
            </div>

            {/* Help Card */}
            <div style={{
              background: '#f7f7f8',
              borderRadius: '8px',
              padding: '16px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                </div>
                <div>
                  <h5 style={{
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#202123',
                    margin: '0 0 4px 0',
                    fontFamily: '"Glacial Indifference", sans-serif'
                  }}>
                    Need help?
                  </h5>
                  <p style={{
                    fontSize: '12px',
                    color: '#6e6e80',
                    margin: '0 0 12px 0',
                    lineHeight: '1.5',
                    fontFamily: '"Glacial Indifference", sans-serif'
                  }}>
                    Our team is here to answer your questions.
                  </p>
                  <Link
                    to="/contact"
                    style={{
                      fontSize: '12px',
                      color: '#202123',
                      fontWeight: '500',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontFamily: '"Glacial Indifference", sans-serif'
                    }}
                  >
                    Get in touch
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14"></path>
                      <path d="M12 5l7 7-7 7"></path>
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
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
          fontFamily: '"Glacial Indifference", sans-serif'
        }}>
          © 2025 Phraze. All rights reserved. Affiliated with Human-Centered Computing Group (HCCG).
        </p>
      </div>
    </main>
  );
}
