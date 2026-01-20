import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase-init';
import AccountSettingsModal from './AccountSettingsModal';
import { useAuth } from '../context/AuthContext';

// Helper to derive initials from firstName and lastName, or fallback to name/email
const getUserInitials = (firstName, lastName, fallbackName) => {
  const firstInitial = firstName && firstName.trim() ? firstName.trim()[0].toUpperCase() : '';
  const lastInitial = lastName && lastName.trim() ? lastName.trim()[0].toUpperCase() : '';
  
  if (firstInitial && lastInitial) {
    return firstInitial + lastInitial;
  } else if (firstInitial) {
    return firstInitial + firstInitial; // Use first letter twice if no last name
  } else if (fallbackName) {
    // Fallback to parsing fallbackName if available
    const names = fallbackName.trim().split(/\s+/);
    if (names.length === 1) {
      return names[0].substring(0, 2).toUpperCase();
    }
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  }
  return 'U';
};

// Helper to generate a consistent color from string
const getAvatarColor = (str) => {
  if (!str) return `hsl(0, 60%, 70%)`;
  return `hsl(${(str.charCodeAt(0) * 10) % 360}, 60%, 70%)`;
};

export default function ProfileDropdown({ userEmail, profileImage, username, firstName, lastName }) {
  const { userProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Use userProfile from context as source of truth, fallback to props if provided
  const actualUserEmail = userProfile?.email || userEmail || auth.currentUser?.email || '';
  const actualProfileImage = userProfile?.profileImage || profileImage || null;
  const actualFirstName = userProfile?.firstName || firstName || null;
  const actualLastName = userProfile?.lastName || lastName || null;
  const actualUsername = userProfile?.username || username || null;
  
  const [displayProfileImage, setDisplayProfileImage] = useState(actualProfileImage);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  
  // Update display profile image when actualProfileImage changes
  useEffect(() => {
    if (actualProfileImage) {
      setDisplayProfileImage(actualProfileImage);
      setImageError(false);
    } else {
      setDisplayProfileImage(null);
      setImageError(false);
    }
  }, [actualProfileImage]);
  
  // Debug logging
  useEffect(() => {
    console.log('[ProfileDropdown] User profile data:', { 
      firstName: actualFirstName, 
      lastName: actualLastName, 
      username: actualUsername, 
      userEmail: actualUserEmail, 
      hasProfileImage: !!actualProfileImage 
    });
  }, [actualFirstName, actualLastName, actualUsername, actualUserEmail, actualProfileImage]);

  // Listen for custom profileImageUpdated event
  useEffect(() => {
    const handleProfileImageUpdate = (event) => {
      console.log('[ProfileDropdown] Received profileImageUpdated event');
      if (event.detail && event.detail.imageUrl) {
        setDisplayProfileImage(event.detail.imageUrl);
        setImageError(false);
      }
    };
    
    window.addEventListener('profileImageUpdated', handleProfileImageUpdate);
    
    return () => {
      window.removeEventListener('profileImageUpdated', handleProfileImageUpdate);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleImageError = (e) => {
    console.error('[ProfileDropdown] ❌ Profile image failed to load:', displayProfileImage);
    console.error('[ProfileDropdown] Error event:', e);
    setImageError(true);
    // Clear out the broken image so we fall back to initials avatar
    setDisplayProfileImage(null);
  };
  
  const handleImageLoad = () => {
    console.log('[ProfileDropdown] ✅ Profile image loaded successfully:', displayProfileImage);
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

      // Navigate to home page
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };


  return (
    <>
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <button
          id="navbarProfilePicture"
          onClick={() => {
            console.log('ProfileDropdown button clicked. Current isOpen:', isOpen);
            setIsOpen(!isOpen);
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {!imageError && displayProfileImage ? (
            <img
              src={displayProfileImage}
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
                backgroundColor: getAvatarColor(actualUserEmail),
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
              {getUserInitials(actualFirstName, actualLastName, actualUsername || actualUserEmail)}
            </div>
          )}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 0.2s ease'
            }}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        {isOpen && (
          <div
            className="profile-dropdown-menu"
            style={{
              position: 'fixed',
              top: '80px',
              right: '208px',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              width: '240px',
              transformOrigin: 'top right',
              animation: 'fadeIn 0.2s ease-out',
              zIndex: 9999
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
              <div style={{ marginBottom: '6px' }}>{actualUserEmail}</div>
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

      <AccountSettingsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

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