import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase-init';
import AccountSettingsModal from './AccountSettingsModal';
import { listenToUserPresenceCanonical, getPresenceColor, getPresenceLabel } from '../utils/presence';

export default function SidebarProfileDropdown({ userEmail, profileImage, username, firstName, lastName, isLoggedIn, onLogout, rightAddon, isCollapsed, className }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [actualProfileImage, setActualProfileImage] = useState(profileImage);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [currentUserPresence, setCurrentUserPresence] = useState('offline');
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const presenceListenerRef = useRef(null);

  // Get current user email from Firebase auth and set up presence listener
  useEffect(() => {
    let retryTimeout = null;
    
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && user.email) {
        setCurrentUserEmail(user.email);
        
        // Clean up previous listener and timeout
        if (presenceListenerRef.current) {
          const cleanup = presenceListenerRef.current;
          if (typeof cleanup === 'function') {
            cleanup();
          }
          presenceListenerRef.current = null;
        }
        if (retryTimeout) {
          clearTimeout(retryTimeout);
          retryTimeout = null;
        }
        
        // Set up presence listener for current user
        const setupListener = () => {
          const cleanupPresence = listenToUserPresenceCanonical(user.email, (presence) => {
            setCurrentUserPresence(presence);
          });
          presenceListenerRef.current = cleanupPresence;
        };
        
        // Set up immediately
        setupListener();
        
        // Also re-setup after a delay to catch race conditions where
        // the listener is set up before initializePresence() completes
        // This ensures we pick up the status once presence is fully initialized
        retryTimeout = setTimeout(() => {
          if (presenceListenerRef.current) {
            const cleanup = presenceListenerRef.current;
            if (typeof cleanup === 'function') {
              cleanup();
            }
          }
          setupListener();
          retryTimeout = null;
        }, 1500); // 1.5 second delay to allow presence to initialize
      } else {
        setCurrentUserEmail('');
        if (presenceListenerRef.current) {
          const cleanup = presenceListenerRef.current;
          if (typeof cleanup === 'function') {
            cleanup();
          }
          presenceListenerRef.current = null;
        }
        if (retryTimeout) {
          clearTimeout(retryTimeout);
          retryTimeout = null;
        }
        setCurrentUserPresence('offline');
      }
    });

    return () => {
      unsubscribe();
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (presenceListenerRef.current) {
        const cleanup = presenceListenerRef.current;
        if (typeof cleanup === 'function') {
          cleanup();
        }
      }
    };
  }, []);

  // Update profile image when prop changes
  useEffect(() => {
    // Removed console.log for performance
    if (profileImage) {
      setActualProfileImage(profileImage);
      setImageError(false);
    }
    
    // Listen for custom profileImageUpdated event
    const handleProfileImageUpdate = (event) => {
      // Removed console.log for performance
      if (event.detail && event.detail.imageUrl) {
        setActualProfileImage(event.detail.imageUrl);
        setImageError(false);
      }
    };
    
    window.addEventListener('profileImageUpdated', handleProfileImageUpdate);
    
    return () => {
      window.removeEventListener('profileImageUpdated', handleProfileImageUpdate);
    };
  }, [profileImage]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper function to get user initials from firstName and lastName (no email fallback)
  const getUserInitials = (first, last) => {
    const firstInitial = first && first.trim() ? first.trim()[0].toUpperCase() : '';
    const lastInitial = last && last.trim() ? last.trim()[0].toUpperCase() : '';
    
    if (firstInitial && lastInitial) {
      return firstInitial + lastInitial;
    } else if (firstInitial) {
      return firstInitial + firstInitial;
    }
    // No email fallback - return placeholder if no name available
    return 'U';
  };

  // Helper function to get avatar color based on email - matches admin modal style
  // Always use email for consistent colors across the app
  const getAvatarColor = (email) => {
    if (!email) return `hsl(0, 60%, 70%)`;
    // Use email for color generation to match admin modal
    return `hsl(${email.charCodeAt(0) * 10 % 360}, 60%, 70%)`;
  };

  const handleImageError = (e) => {
    console.error('[SidebarProfileDropdown] ❌ Profile image failed to load:', actualProfileImage);
    console.error('[SidebarProfileDropdown] Error event:', e);
    setImageError(true);
  };
  
  const handleImageLoad = () => {
    // Removed console.log for performance
  };

  const handleLogout = async () => {
    try {
      // Clear local storage
      localStorage.removeItem("currentUser");
      localStorage.removeItem("companyEmail");
      localStorage.removeItem("currentProject");
      localStorage.removeItem("sharedCompanyEmail");
      localStorage.removeItem("sharedProjectId");
      console.log("Removed companyEmail and project context");  

      // Dispatch a custom event to clear chats
      const clearChatsEvent = new CustomEvent('clearChats');
      window.dispatchEvent(clearChatsEvent);

      // Sign out from Firebase
      await auth.signOut();

      // Call the onLogout prop if provided
      if (onLogout) {
        onLogout();
      }

      // Navigate to home page
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <>
      <div ref={dropdownRef} className={className || ''} style={{ 
        position: 'relative',
        borderTop: 'none',
        padding: isCollapsed ? '0.5rem' : '1rem',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        gap: '0.75rem'
      }}>
        <div
          style={{ cursor: 'pointer' }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isCollapsed ? '0' : '0.75rem',
            flex: 1,
            justifyContent: isCollapsed ? 'center' : 'flex-start'
          }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
            {!imageError && actualProfileImage ? (
              <img
                src={actualProfileImage}
                alt="Profile"
                onError={handleImageError}
                onLoad={handleImageLoad}
                referrerPolicy="no-referrer"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  display: 'block',
                  border: '1px solid #e5e7eb'
                }}
              />
            ) : (
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: getAvatarColor(currentUserEmail || userEmail),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'white',
                  textTransform: 'uppercase',
                  flexShrink: 0
                }}
              >
                {getUserInitials(firstName, lastName)}
              </div>
            )}
              {/* Presence Status Indicator */}
              <div style={{
                position: 'absolute',
                bottom: '-2px',
                right: '0px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: getPresenceColor(currentUserPresence),
                border: '2px solid white',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }} title={getPresenceLabel(currentUserPresence)} />
            </div>

            {!isCollapsed && (
              <div style={{
                fontSize: '0.875rem',
                color: '#333333',
                fontWeight: '500'
              }}>
                {username || currentUserEmail?.split('@')[0] || 'Loading...'}
              </div>
            )}
          </div>
        </div>

        {rightAddon && !isCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {rightAddon}
          </div>
        )}

        {isOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: '0',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              width: '240px',
              transformOrigin: 'bottom left',
              animation: 'fadeIn 0.2s ease-out',
              zIndex: 1000
            }}
          >
            {/* Email header with role badge */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                color: '#4B5563',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              <div style={{ marginBottom: '6px' }}>{currentUserEmail}</div>
              {typeof window !== 'undefined' && window.currentUserRole && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  background: window.currentUserRole === 'viewer' 
                    ? '#fef3c7' 
                    : window.currentUserRole === 'editor'
                    ? '#dbeafe'
                    : '#dcfce7',
                  color: window.currentUserRole === 'viewer'
                    ? '#92400e'
                    : window.currentUserRole === 'editor'
                    ? '#1e40af'
                    : '#166534'
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {window.currentUserRole === 'viewer' ? (
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    ) : window.currentUserRole === 'editor' ? (
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    ) : (
                      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                    )}
                  </svg>
                  <span style={{ textTransform: 'capitalize' }}>{window.currentUserRole}</span>
                </div>
              )}
            </div>

            {/* Menu items */}
            <div style={{ padding: '8px 0' }}>
              {/* Account Settings */}
              <button
                id="accountSettingsModalOpenButton"
                onClick={() => {
                  setIsModalOpen(true);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '10px 16px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  minHeight: '36px',
                  boxSizing: 'border-box'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#F3F4F6';
                  e.target.style.borderRadius = '8px';
                  e.target.style.margin = '0 4px';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.margin = '0';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"></path>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"></path>
                </svg>
                Account Settings
              </button>

              {/* Divider */}
              <div style={{
                height: '1px',
                background: 'rgba(0, 0, 0, 0.1)',
                margin: '8px 12px'
              }} />

              {/* Log out */}
              <button
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '10px 16px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  minHeight: '36px',
                  boxSizing: 'border-box'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#F3F4F6';
                  e.target.style.borderRadius = '8px';
                  e.target.style.margin = '0 4px';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.margin = '0';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Log out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Account Settings Modal */}
      {isModalOpen && (
        <AccountSettingsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: scale(0.95) translateY(-10px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
        `}
      </style>
    </>
  );
}
