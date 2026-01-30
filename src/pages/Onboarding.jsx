import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, database } from '../firebase-init';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue, off, get } from 'firebase/database';
import { getMainCompanyEmail, getFirebaseData, saveFirebaseData } from '../funcs';
import { compressImage } from '../utils/imageCompression';
import { useAuth } from '../context/AuthContext';

// ContextPanel Component - Visual Diagram
const ContextPanel = () => {
  const CircularStepItem = ({ icon, label, position }) => {
    let labelStyle = {
      position: 'absolute',
      zIndex: 10,
      whiteSpace: 'nowrap',
      fontSize: '13px',
      fontWeight: '600',
      letterSpacing: '0.025em',
      color: '#6B7280',
      background: '#F9FAFB',
      padding: '4px 8px',
      borderRadius: '6px'
    };

    switch (position) {
      case 'top':
        labelStyle = { ...labelStyle, bottom: '100%', marginBottom: '12px', left: '50%', transform: 'translateX(-50%)' };
        break;
      case 'bottom':
        labelStyle = { ...labelStyle, top: '100%', marginTop: '12px', left: '50%', transform: 'translateX(-50%)' };
        break;
      case 'left':
        labelStyle = { ...labelStyle, right: '100%', marginRight: '12px', top: '50%', transform: 'translateY(-50%)' };
        break;
      case 'right':
        labelStyle = { ...labelStyle, left: '100%', marginLeft: '12px', top: '50%', transform: 'translateY(-50%)' };
        break;
    }

    return (
      <div style={{
        position: 'relative',
        width: '56px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          position: 'relative',
          zIndex: 10,
          width: '56px',
          height: '56px',
          background: '#ffffff',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #E5E7EB',
          color: '#6B7280',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#E38290';
          e.currentTarget.style.color = '#E38290';
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(227, 130, 144, 0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#E5E7EB';
          e.currentTarget.style.color = '#6B7280';
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.04)';
        }}
        >
          {icon}
        </div>
        <span style={labelStyle}>{label}</span>
      </div>
    );
  };

  return (
    <div style={{
      flex: '1',
      background: '#F9FAFB',
      padding: '3rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Subtle gradient overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(ellipse at top right, rgba(227, 130, 144, 0.03) 0%, transparent 50%)',
        pointerEvents: 'none'
      }} />

      {/* Cycle Diagram Container */}
      <div style={{
        position: 'relative',
        width: '280px',
        height: '280px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        animation: 'fadeInScale 0.6s ease-out'
      }}>
        {/* Connecting Ring */}
        <div style={{
          position: 'absolute',
          inset: '-1px',
          border: '2px solid #D1D5DB',
          borderRadius: '50%',
          zIndex: 0,
          transition: 'all 0.3s ease'
        }} />

        {/* Directional Arrows */}
        {/* Top-Right (Chat -> Highlight) */}
        <div style={{
          position: 'absolute',
          top: '14.65%',
          right: '14.65%',
          transform: 'translateY(-50%) translateX(50%)',
          zIndex: 10
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(45deg)' }}>
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
        
        {/* Bottom-Right (Highlight -> Annotate) */}
        <div style={{
          position: 'absolute',
          bottom: '14.65%',
          right: '14.65%',
          transform: 'translateY(50%) translateX(50%)',
          zIndex: 10
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(135deg)' }}>
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
        
        {/* Bottom-Left (Annotate -> Share) */}
        <div style={{
          position: 'absolute',
          bottom: '14.65%',
          left: '14.65%',
          transform: 'translateY(50%) translateX(-50%)',
          zIndex: 10
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(225deg)' }}>
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
        
        {/* Top-Left (Share -> Chat) */}
        <div style={{
          position: 'absolute',
          top: '14.65%',
          left: '14.65%',
          transform: 'translateY(-50%) translateX(-50%)',
          zIndex: 10
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(315deg)' }}>
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>

        {/* Step Nodes */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%) translateY(-50%)',
          zIndex: 20
        }}>
          <CircularStepItem 
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            }
            label="Chat"
            position="top"
          />
        </div>

        <div style={{
          position: 'absolute',
          top: '50%',
          right: 0,
          transform: 'translateX(50%) translateY(-50%)',
          zIndex: 20
        }}>
          <CircularStepItem 
            icon={
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2.5 1a.5.5 0 0 1 .5.5v3a.5.5 0 0 0 .5.5h9.002a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 1 1 0v3a1.5 1.5 0 0 1-1.001 1.415V7a2 2 0 0 1-2 2H11l.003 1.74a1.5 1.5 0 0 1-.69 1.265l-4.54 2.916a.5.5 0 0 1-.77-.421V9H5a2 2 0 0 1-2-2V5.915A1.5 1.5 0 0 1 2 4.5v-3a.5.5 0 0 1 .5-.5Zm3.503 8v4.585l3.77-2.422a.5.5 0 0 0 .23-.421L10 9H6.003ZM4 7a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V6H4v1Z"/>
              </svg>
            }
            label="Highlight"
            position="right"
          />
        </div>

        <div style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%) translateY(50%)',
          zIndex: 20
        }}>
          <CircularStepItem 
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            }
            label="Annotate"
            position="bottom"
          />
        </div>

        <div style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          transform: 'translateX(-50%) translateY(-50%)',
          zIndex: 20
        }}>
          <CircularStepItem 
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
            }
            label="Share"
            position="left"
          />
        </div>
      </div>
    </div>
  );
};

export default function Onboarding() {
  const navigate = useNavigate();
  const { userProfile, refreshUserProfile } = useAuth();
  
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const fileInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [bio, setBio] = useState('');
  
  // Local state for firstName/lastName that can be updated by Firebase listener
  const [localFirstName, setLocalFirstName] = useState('');
  const [localLastName, setLocalLastName] = useState('');
  
  // Use context data directly
  const userEmail = userProfile.email || '';
  const firstName = localFirstName || userProfile.firstName || '';
  const lastName = localLastName || userProfile.lastName || '';
  const dataLoaded = !!userProfile.email; // Data is loaded if we have an email

  // Load existing profile picture from context
  useEffect(() => {
    if (userProfile.profileImage) {
      setAvatarPreview(userProfile.profileImage);
    }
  }, [userProfile.profileImage]);

  // Initialize local state from userProfile when available
  useEffect(() => {
    if (userProfile.firstName && !localFirstName) {
      setLocalFirstName(userProfile.firstName);
    }
    if (userProfile.lastName && !localLastName) {
      setLocalLastName(userProfile.lastName);
    }
  }, [userProfile.firstName, userProfile.lastName]);

  // Set up Firebase listener for firstName and lastName to update initials in real-time
  useEffect(() => {
    if (!userEmail) return;

    let unsubscribeFn = null;
    let userDataRef = null;
    let mounted = true;

    // Fetch companyEmail if not available in userProfile
    const setupListener = async () => {
      let companyEmail = userProfile.companyEmail;
      
      // Try localStorage as fallback
      if (!companyEmail) {
        const storedCompanyEmail = localStorage.getItem('companyEmail');
        if (storedCompanyEmail) {
          // localStorage stores in Firebase format (commas), but we need dots for path building
          companyEmail = storedCompanyEmail.replace(/,/g, '.');
        }
      }
      
      // If companyEmail is not in context or localStorage, fetch it from Firebase
      if (!companyEmail) {
        try {
          const emailPath = userEmail.replace(/\./g, ',');
          companyEmail = await getFirebaseData(`emailToCompanyDirectory/${emailPath}`);
          if (!companyEmail) {
            // No mapping found/accessible; fall back to user-scoped path
            companyEmail = null;
          }
        } catch (error) {
          console.error('Error fetching company email:', error);
          companyEmail = null;
        }
      }

      if (!mounted) return;

      // Format emails for Firebase paths (replace dots with commas)
      const emailPath = userEmail.replace(/\./g, ',');
      const userDataPath = companyEmail
        ? `Companies/${companyEmail.replace(/\./g, ',')}/users/${emailPath}`
        : `Users/${emailPath}`;
      userDataRef = ref(database, userDataPath);

      // Fetch initial data immediately
      try {
        const initialSnapshot = await get(userDataRef);
        if (initialSnapshot.exists() && mounted) {
          const userData = initialSnapshot.val();
          if (userData) {
            setLocalFirstName(userData.firstName || '');
            setLocalLastName(userData.lastName || '');
          }
        }
      } catch (error) {
        console.error('Error fetching initial user data:', error);
      }

      // Set up real-time listener for updates
      if (mounted && userDataRef) {
        unsubscribeFn = onValue(userDataRef, (snapshot) => {
          if (!mounted) return;
          const userData = snapshot.val();
          if (userData) {
            // Update local state when Firebase data changes (even if empty/null)
            setLocalFirstName(userData.firstName || '');
            setLocalLastName(userData.lastName || '');
          }
        });
      }
    };

    setupListener();

    return () => {
      mounted = false;
      if (unsubscribeFn && userDataRef) {
        try {
          off(userDataRef, 'value', unsubscribeFn);
        } catch (e) {
          console.warn('Error cleaning up listener:', e);
        }
      }
    };
  }, [userEmail, userProfile.companyEmail]);


  const handleComplete = async () => {
    if (!username.trim() || username.length < 3) {
      return;
    }

    setLoading(true);
    try {
      const emailPath = userEmail.replace(/\./g, ',');
      const companyEmail = (await getMainCompanyEmail()) || emailPath;

      const isPermissionDenied = (err) => {
        const msg = err?.message || '';
        return (
          err?.code === 'PERMISSION_DENIED' ||
          msg.includes('PERMISSION_DENIED') ||
          msg.toLowerCase().includes('permission denied')
        );
      };

      const writeOnboardingData = async (basePath) => {
        await saveFirebaseData(`${basePath}/onboardingCompleted`, true);

        if (username.trim()) {
          await saveFirebaseData(`${basePath}/name`, username.trim());
          await saveFirebaseData(`${basePath}/username`, username.trim());
        }

        if (bio.trim()) {
          await saveFirebaseData(`${basePath}/bio`, bio.trim());
        }

        if (avatarPreview && avatarPreview.startsWith('data:image/')) {
          await saveFirebaseData(`${basePath}/profileImage`, avatarPreview);
          console.log('Saved new profile picture to Firebase');
        }
      };

      const companyBasePath = `Companies/${companyEmail}/users/${emailPath}`;
      const userBasePath = `Users/${emailPath}`;
      
      try {
        await writeOnboardingData(companyBasePath);
      } catch (error) {
        if (!isPermissionDenied(error)) {
          throw error;
        }
        await writeOnboardingData(userBasePath);
      }

      console.log('Onboarding completed successfully');
      
      // Refresh context to update onboarding status everywhere
      await refreshUserProfile();
      
      // Redirect to demonstration page
      navigate('/demonstration', { replace: true });
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && username.trim() && username.length >= 3 && !loading) {
      handleComplete();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // Compress the image before setting preview
        const compressedDataURL = await compressImage(file, {
          maxWidth: 300,
          maxHeight: 300,
          quality: 0.8,
          maxSizeKB: 100
        });
        setAvatarPreview(compressedDataURL);
      } catch (error) {
        console.error('Error compressing image:', error);
        // Fallback to regular FileReader if compression fails
        const reader = new FileReader();
        reader.onloadend = () => {
          setAvatarPreview(reader.result);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const isValid = username.length >= 3;
  const showError = touched && username.length > 0 && !isValid;

  // Helper function to get user initials from firstName and lastName (no email fallback)
  const getUserInitials = (first, last) => {
    const firstInitial = first && first.trim() ? first.trim()[0].toUpperCase() : '';
    const lastInitial = last && last.trim() ? last.trim()[0].toUpperCase() : '';
    
    if (firstInitial && lastInitial) {
      return firstInitial + lastInitial;
    } else if (firstInitial) {
      return firstInitial + firstInitial; // Use first letter twice if no last name
    }
    // No fallback - return empty string if no name available (Firebase listener will update when data is available)
    return '';
  };

  // Helper function to get avatar color based on email
  const getAvatarColor = (str) => {
    if (!str) return `hsl(0, 60%, 70%)`;
    return `hsl(${str.charCodeAt(0) * 10 % 360}, 60%, 70%)`;
  };

  // Get initials from firstName and lastName
  // Use local state (from Firebase listener) or fallback to userProfile
  // Firebase listener will update this in real-time when data is saved
  const initials = useMemo(() => {
    // Compute initials from firstName and lastName (from Firebase listener or context)
    // This will return empty string if no data is available yet
    return getUserInitials(firstName, lastName);
  }, [firstName, lastName]);
  
  const avatarColor = getAvatarColor(userEmail);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      background: '#fbfbfb',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      {/* Background Rings Effect */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.4
      }}>
        <div style={{
          width: '800px',
          height: '800px',
          borderRadius: '50%',
          border: '1px solid #F3F4F6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '650px',
            height: '650px',
            borderRadius: '50%',
            border: '1px solid #F3F4F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '500px',
              height: '500px',
              borderRadius: '50%',
              border: '1px solid #F3F4F6'
            }} />
          </div>
        </div>
      </div>

      {/* Main Card Container */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        background: '#ffffff',
        width: '100%',
        maxWidth: '1080px',
        borderRadius: '32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.02)',
        overflow: 'hidden',
        minHeight: '600px',
        display: 'flex',
        border: '1px solid rgba(0, 0, 0, 0.04)'
      }}>
        {/* Left Panel - Form Card */}
        <div style={{
          flex: '1',
          maxWidth: '540px',
          width: '100%'
        }}>
        <div style={{
          background: '#ffffff',
          padding: '3.5rem',
          position: 'relative',
          overflow: 'hidden',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{ width: '100%' }}>
            <div style={{
              marginBottom: '2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center'
            }}>
              {/* Profile Picture Upload */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '1.5rem'
              }}>
                <div 
                  style={{
                    position: 'relative',
                    cursor: 'pointer'
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.95';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  {/* Main Avatar Circle */}
                  <div style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: avatarPreview ? '#F3F4F6' : avatarColor,
                    border: '4px solid white',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    if (e.currentTarget.closest('[onClick]')) {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.06)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)';
                  }}
                  >
                    {avatarPreview ? (
                      <img 
                        src={avatarPreview} 
                        alt="Profile preview" 
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '32px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        backgroundColor: avatarColor
                      }}>
                        {initials}
                      </div>
                    )}
                  </div>
                  
                  {/* Floating Action Badge */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    transform: 'translate(4px, 4px)'
                  }}>
                    <div style={{
                      background: '#000000',
                      color: 'white',
                      borderRadius: '50%',
                      padding: '8px',
                      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
                      border: '2px solid white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.1)';
                      e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                    }}
                    >
                      {avatarPreview ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                          <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                      )}
                    </div>
                  </div>
                  
                  {/* Hidden Input */}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*" 
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              <div style={{
                maxWidth: '512px',
                margin: '0 auto'
              }}>
                <h1 style={{
                  fontSize: '28px',
                  fontWeight: '700',
                  color: '#111827',
                  letterSpacing: '-0.03em',
                  marginBottom: '0.75rem',
                  lineHeight: '1.2'
                }}>
                  Create your account
                </h1>
                <p style={{
                  color: '#6B7280',
                  fontSize: '15px',
                  lineHeight: '1.6',
                  maxWidth: '400px',
                  margin: '0 auto'
                }}>
                  This is how others will see you in Phraze. You can change it later.
                </p>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleComplete(); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label htmlFor="username" style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  color: '#6B7280',
                  marginLeft: '4px'
                }}>
                  Username
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontWeight: '500',
                    transition: 'color 0.2s',
                    color: touched ? '#111827' : '#9CA3AF'
                  }}>
                    @
                  </span>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                      setUsername(value);
                      setTouched(true);
                    }}
                    onKeyPress={handleKeyPress}
                    style={{
                      display: 'block',
                      width: '100%',
                      paddingLeft: '36px',
                      paddingRight: '40px',
                      paddingTop: '14px',
                      paddingBottom: '14px',
                      background: touched ? '#ffffff' : '#F9FAFB',
                      border: `1.5px solid ${showError ? '#EF4444' : '#E5E7EB'}`,
                      borderRadius: '12px',
                      fontSize: '16px',
                      fontWeight: '500',
                      color: '#111827',
                      placeholderColor: '#9CA3AF',
                      outline: 'none',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxSizing: 'border-box'
                    }}
                    placeholder="username"
                    autoComplete="off"
                    spellCheck={false}
                    autoFocus
                    onFocus={(e) => {
                      e.target.style.background = '#ffffff';
                      e.target.style.borderColor = showError ? '#EF4444' : '#10a37f';
                      e.target.style.boxShadow = showError ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : '0 0 0 3px rgba(16, 163, 127, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.background = touched ? '#ffffff' : '#F9FAFB';
                      e.target.style.borderColor = showError ? '#EF4444' : '#E5E7EB';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  
                  {/* Status Indicators */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    right: '12px',
                    transform: 'translateY(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none'
                  }}>
                    {loading && (
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                    )}
                    {isValid && username.length >= 3 && !loading && (
                      <div 
                        className="success-checkmark"
                        style={{
                          background: '#10B981',
                          borderRadius: '50%',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                    )}
                    {showError && !loading && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                    )}
                  </div>
                </div>

                <div style={{
                  minHeight: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  marginLeft: '4px'
                }}>
                  {showError && (
                    <p style={{
                      fontSize: '12px',
                      color: '#DC2626',
                      fontWeight: '500',
                      margin: 0
                    }}>
                      Username unavailable or too short.
                    </p>
                  )}
                  {isValid && username.length >= 3 && (
                    <p style={{
                      fontSize: '12px',
                      color: '#10B981',
                      fontWeight: '500',
                      margin: 0
                    }}>
                      Username is available.
                    </p>
                  )}
                  {!showError && !isValid && (
                    <p style={{
                      fontSize: '12px',
                      color: '#9CA3AF',
                      margin: 0,
                      lineHeight: '1.4'
                    }}>
                      3+ characters, letters, numbers, and underscores only
                    </p>
                  )}
                </div>
              </div>

              {/* Bio Section - Optional */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginLeft: '4px' }}>
                  <label htmlFor="bio" style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: '#6B7280'
                  }}>
                    Bio <span style={{ fontSize: '11px', fontWeight: '400', color: '#9CA3AF' }}>(optional)</span>
                  </label>
                  {bio.length > 0 && (
                    <span style={{
                      fontSize: '11px',
                      color: '#9CA3AF',
                      fontWeight: '400'
                    }}>
                      {bio.length}/200
                    </span>
                  )}
                </div>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => {
                    if (e.target.value.length <= 200) {
                      setBio(e.target.value);
                    }
                  }}
                  placeholder="Tell others about yourself..."
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: bio.length > 0 ? '#ffffff' : '#F9FAFB',
                    border: '1.5px solid #E5E7EB',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    color: '#111827',
                    minHeight: '80px',
                    resize: 'vertical',
                    outline: 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxSizing: 'border-box',
                    lineHeight: '1.5'
                  }}
                  onFocus={(e) => {
                    e.target.style.background = '#ffffff';
                    e.target.style.borderColor = '#10a37f';
                    e.target.style.boxShadow = '0 0 0 3px rgba(16, 163, 127, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.background = bio.length > 0 ? '#ffffff' : '#F9FAFB';
                    e.target.style.borderColor = '#E5E7EB';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <p style={{
                  fontSize: '12px',
                  color: '#9CA3AF',
                  margin: 0,
                  marginLeft: '4px',
                  lineHeight: '1.4'
                }}>
                  A brief description about yourself (max 200 characters)
                </p>
              </div>

              <button
                type="submit"
                disabled={!isValid || loading}
                style={{
                  width: '100%',
                  height: '48px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#ffffff',
                  background: (!isValid || loading) ? '#C5C5D2' : '#000000',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (!isValid || loading) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: (!isValid || loading) ? 'none' : '0 4px 12px rgba(0, 0, 0, 0.15)',
                  opacity: (!isValid || loading) ? 0.5 : 1,
                  transform: (!isValid || loading) ? 'none' : 'translateY(0)'
                }}
                onMouseEnter={(e) => {
                  if (isValid && !loading) {
                    e.target.style.background = '#1F2937';
                    e.target.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.2)';
                    e.target.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (isValid && !loading) {
                    e.target.style.background = '#000000';
                    e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                    e.target.style.transform = 'translateY(0)';
                  }
                }}
                onMouseDown={(e) => {
                  if (isValid && !loading) {
                    e.target.style.transform = 'translateY(0)';
                  }
                }}
                onMouseUp={(e) => {
                  if (isValid && !loading) {
                    e.target.style.transform = 'translateY(-1px)';
                  }
                }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Setting up...</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </>
                )}
              </button>

              {/* Sign in with another account link */}
              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
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
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#6b7280',
                    textDecoration: 'none',
                    fontFamily: 'inherit',
                    transition: 'color 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = '#111827';
                    e.target.style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = '#6b7280';
                    e.target.style.textDecoration = 'none';
                  }}
                >
                  Sign in with another account
                </button>
              </div>
            </form>
          </div>
        </div>
        </div>

        {/* Right Panel - Visual */}
        <ContextPanel />
      </div>

      {/* Minimal Footer */}
      <div style={{
        position: 'fixed',
        bottom: '32px',
        width: '100%',
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: 100
      }}>
        <span style={{
          fontSize: '10px',
          fontWeight: '500',
          color: '#D1D5DB',
          textTransform: 'uppercase',
          letterSpacing: '0.2em'
        }}>
          Phraze
        </span>
      </div>

      {/* Loading spinner animation */}
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes checkmark-pop {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes fadeInScale {
          0% {
            opacity: 0;
            transform: scale(0.95);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }
        @keyframes gradientShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        .success-checkmark {
          animation: checkmark-pop 0.3s ease-out;
        }
        .pulse-ring {
          animation: pulse 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
