import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase-init';
import { useAuth } from '../context/AuthContext';
import { Loader2, LogOut, CheckCircle2 } from 'lucide-react';

export default function AccessDenied() {
  const navigate = useNavigate();
  const { isWhitelisted, userProfile, user } = useAuth();
  const [dots, setDots] = useState('');

  const currentUserEmail = user?.email || userProfile?.email || '';

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length < 3 ? prev + '.' : '');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#fcfbf8',
      padding: '1rem',
      color: '#202123'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '28rem'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2rem'
        }}>
          
          {/* Icon Section */}
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'relative',
              background: isWhitelisted 
                ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                : '#ffffff',
              padding: '1rem',
              borderRadius: '50%',
              border: isWhitelisted 
                ? '1px solid #10b981'
                : '1px solid #f3f4f6',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
            }}>
              {isWhitelisted ? (
                <CheckCircle2 
                  style={{
                    width: '2rem',
                    height: '2rem',
                    color: '#10b981'
                  }}
                  strokeWidth={2}
                />
              ) : (
                <Loader2 
                  style={{
                    width: '2rem',
                    height: '2rem',
                    color: '#202123'
                  }}
                  strokeWidth={1.5}
                  className="animate-spin-slow"
                />
              )}
            </div>
          </div>

          {/* Main Text Content */}
          <div style={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              letterSpacing: '-0.025em',
              color: '#202123',
              margin: 0
            }}>
              {isWhitelisted ? 'Account Activated' : 'Waiting for approval'}
            </h1>
            <p style={{
              color: '#6E6E80',
              fontSize: '0.875rem',
              lineHeight: '1.5',
              maxWidth: '20rem',
              margin: '0 auto'
            }}>
              {isWhitelisted 
                ? 'Your account has been approved! You now have full access to PhrazeApp Beta. Redirecting you to the application...'
                : 'Your account has been created. We are reviewing your request and will grant access automatically.'
              }
            </p>
          </div>

          {!isWhitelisted && (
            <>
              {/* User Info & Status Box */}
              <div style={{
                width: '100%',
                background: '#ffffff',
                borderRadius: '0.5rem',
                border: '1px solid #e5e7eb',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                overflow: 'hidden'
              }}>
                {/* Email Section */}
                {currentUserEmail && (
                  <div style={{
                    paddingLeft: '1.25rem',
                    paddingRight: '1.25rem',
                    paddingTop: '1rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid #f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    background: '#ffffff'
                  }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      textAlign: 'left',
                      width: '100%'
                    }}>
                      <span style={{
                        fontSize: '0.625rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: '#8E8EA0',
                        fontWeight: '600',
                        marginBottom: '0.25rem'
                      }}>
                        Signed in as
                      </span>
                      <span style={{
                        fontSize: '0.9375rem',
                        fontWeight: '500',
                        color: '#202123',
                        letterSpacing: 'normal'
                      }}>
                        {currentUserEmail}
                      </span>
                    </div>
                  </div>
                )}

                {/* Live Status Indicator - Replaced green dot with monochrome spinner */}
                <div style={{
                  paddingLeft: '1.25rem',
                  paddingRight: '1.25rem',
                  paddingTop: '0.75rem',
                  paddingBottom: '0.75rem',
                  background: '#F9F9FA',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}>
                  <Loader2 
                    style={{
                      width: '0.875rem',
                      height: '0.875rem',
                      color: '#6E6E80'
                    }}
                    className="animate-spin"
                  />
                  <p style={{
                    fontSize: '0.75rem',
                    color: '#6E6E80',
                    fontWeight: '500',
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                    margin: 0
                  }}>
                    Monitoring status{dots}
                  </p>
                </div>
              </div>

              {/* Action Links */}
              <div style={{ paddingTop: '0.5rem' }}>
                <button 
                  onClick={async () => {
                    try {
                      await auth.signOut();
                      navigate('/auth', { replace: true });
                    } catch (error) {
                      console.error('Error signing out:', error);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#6E6E80',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    fontFamily: 'inherit',
                    transition: 'color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#202123';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#6E6E80';
                  }}
                >
                  <LogOut 
                    style={{
                      width: '1rem',
                      height: '1rem',
                      transition: 'transform 0.2s ease'
                    }}
                  />
                  <span>Sign in with another account</span>
                </button>
              </div>
            </>
          )}

          {isWhitelisted && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1.5rem',
              background: '#ecfdf5',
              borderRadius: '0.75rem',
              border: '1px solid #a7f3d0'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
              }}></div>
              <span style={{
                fontSize: '0.875rem',
                color: '#065f46',
                fontWeight: '500'
              }}>
                Redirecting...
              </span>
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        .animate-spin-slow {
          animation: spin 2s linear infinite;
        }
      `}</style>
    </div>
  );
}
