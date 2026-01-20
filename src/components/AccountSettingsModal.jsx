import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../firebase-init';
import { updateProfile, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { getFirebaseData, getMainCompanyEmail, saveFirebaseData, updateProfilePicture, firebaseListener, showToast } from '../funcs';
import { useAuth } from '../context/AuthContext';
import { getImagePath } from '../utils/assetPaths';
import { compressImage } from '../utils/imageCompression';
import { HiX, HiEye, HiEyeOff, HiUpload } from 'react-icons/hi';
import { HiUser } from 'react-icons/hi';
import { FiImage } from 'react-icons/fi';

// CSS Variables (matching reference styles.css)
const colors = {
  white: '#ffffff',
  black: '#000000',
  neutral50: '#fafafa',
  neutral100: '#f5f5f5',
  neutral200: '#e5e5e5',
  neutral300: '#d4d4d4',
  neutral400: '#a3a3a3',
  neutral500: '#737373',
  neutral600: '#525252',
  neutral700: '#404040',
  neutral800: '#262626',
  neutral900: '#171717',
};

// Font family matching website
const fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

// Settings Tab Enum
const SettingsTab = {
  Profile: 'Profile',
  Security: 'Security'
};

// Button Component - Exact match to reference
const Button = ({ children, variant = 'primary', className = '', isLoading = false, disabled, onClick, style, ...props }) => {
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    fontFamily: fontFamily,
    borderRadius: '10px',
    transition: 'background-color 0.2s, color 0.2s, border-color 0.2s',
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    border: '1px solid transparent',
    ...style
  };

  const variantStyles = {
    primary: {
      backgroundColor: '#111',
      color: colors.white,
    },
    secondary: {
      backgroundColor: colors.white,
      color: '#111',
      borderColor: colors.neutral300,
    },
    ghost: {
      backgroundColor: 'transparent',
      color: colors.neutral600,
    }
  };

  const buttonStyle = {
    ...baseStyle,
    ...variantStyles[variant],
    opacity: disabled || isLoading ? 0.5 : (style?.opacity !== undefined ? style.opacity : 1),
  };

  const hoverStyles = {
    primary: { backgroundColor: '#262626' },
    secondary: { backgroundColor: '#f5f5f5' },
    ghost: { backgroundColor: '#f5f5f5' }
  };

  return (
    <button
      type="button"
      style={{...buttonStyle, ...style}}
      className={className}
      disabled={disabled || isLoading}
      onClick={(e) => {
        if (disabled || isLoading) {
          e.preventDefault();
          return;
        }
        if (onClick) onClick(e);
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isLoading && hoverStyles[variant]) {
          Object.assign(e.target.style, hoverStyles[variant]);
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !isLoading) {
          Object.assign(e.target.style, variantStyles[variant]);
        }
      }}
      {...props}
    >
      {isLoading && (
        <span style={{
          display: 'inline-block',
          width: '1em',
          height: '1em',
          border: '2px solid currentColor',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          marginRight: '0.5rem',
          animation: 'spin 1s linear infinite'
        }} />
      )}
      {children}
    </button>
  );
};

// Input Component - Exact match to reference
const Input = ({ label, description, rightElement, className = '', disabled, style, ...props }) => {
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <label style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: 500,
          fontFamily: fontFamily,
          color: '#111',
          marginBottom: '0.375rem'
        }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <input
          style={{
            width: '100%',
            backgroundColor: disabled ? colors.neutral50 : colors.white,
            border: `1px solid ${colors.neutral300}`,
            borderRadius: '0.5rem',
            padding: '0.625rem 0.75rem',
            paddingRight: rightElement ? '2.5rem' : '0.75rem',
            fontSize: '0.875rem',
            fontFamily: fontFamily,
            color: disabled ? colors.neutral500 : colors.neutral900,
            transition: 'all 0.2s ease-in-out',
            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            outline: 'none',
            ...style
          }}
          className={className}
          disabled={disabled}
          onFocus={(e) => {
            e.target.style.borderColor = colors.neutral400;
            e.target.style.boxShadow = '0 1px 2px 0 rgb(0 0 0 / 0.05)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = colors.neutral300;
            e.target.style.boxShadow = '0 1px 2px 0 rgb(0 0 0 / 0.05)';
          }}
          {...props}
        />
        {rightElement && (
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            paddingRight: '0.75rem',
            color: colors.neutral400
          }}>
            {rightElement}
          </div>
        )}
      </div>
      {description && (
        <p style={{
          marginTop: '0.375rem',
          fontSize: '0.75rem',
          fontFamily: fontFamily,
          color: colors.neutral500,
          lineHeight: 1.5
        }}>
          {description}
        </p>
      )}
    </div>
  );
};

// Profile Section Component - Exact match to reference
const ProfileSection = ({ 
  profile,
  setProfile,
  profileImage, 
  onProfileImageChange,
  isEditingEmail,
  setIsEditingEmail,
  tempEmail,
  setTempEmail,
  handleSaveEmail
}) => {
  const fileInputRef = useRef(null);
  const [avatarHover, setAvatarHover] = useState(false);

  return (
    <div style={{ maxWidth: '42rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Header */}
        <div>
          <h2 style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            fontFamily: fontFamily,
            color: '#111',
            letterSpacing: '-0.01em',
            margin: 0
          }}>
            Profile
          </h2>
        </div>

        <div style={{ height: '1px', backgroundColor: colors.neutral200, width: '100%' }} />
        
        {/* Avatar Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '0.25rem 0' }}>
          <div
            style={{ position: 'relative', cursor: 'pointer', flexShrink: 0, width: '4rem', height: '4rem' }}
            onClick={() => fileInputRef.current?.click()}
            onMouseEnter={() => setAvatarHover(true)}
            onMouseLeave={() => setAvatarHover(false)}
          >
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '9999px',
              backgroundColor: colors.neutral100,
              border: `1px solid ${avatarHover ? colors.neutral300 : colors.neutral200}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.neutral400,
              overflow: 'hidden',
              transition: 'border-color 0.2s'
            }}>
              {profileImage ? (
                <img src={profileImage} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  fontWeight: '600',
                  color: 'white',
                  textTransform: 'uppercase',
                  backgroundColor: profile.email 
                    ? `hsl(${(profile.email.charCodeAt(0) * 10) % 360}, 60%, 70%)`
                    : colors.neutral300
                }}>
                  {(() => {
                    const firstInitial = profile.firstName && profile.firstName.trim() ? profile.firstName.trim()[0].toUpperCase() : '';
                    const lastInitial = profile.lastName && profile.lastName.trim() ? profile.lastName.trim()[0].toUpperCase() : '';
                    
                    if (firstInitial && lastInitial) {
                      return firstInitial + lastInitial;
                    } else if (firstInitial) {
                      return firstInitial + firstInitial;
                    }
                    // No email fallback - return placeholder if no name available
                    return 'U';
                  })()}
                </div>
              )}
            </div>
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: avatarHover ? 1 : 0,
              transition: 'opacity 0.2s',
              backdropFilter: 'blur(1px)',
              pointerEvents: 'none'
            }}>
              <HiUpload size={16} color="white" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))' }} />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={onProfileImageChange}
            />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px', flex: 1 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, fontFamily: fontFamily, color: '#111', margin: 0 }}>
              {profile.firstName && profile.lastName 
                ? `${profile.firstName} ${profile.lastName}` 
                : profile.firstName || profile.username || profile.email?.split('@')[0] || 'User'}
            </h3>
            <p style={{ fontSize: '0.875rem', color: colors.neutral500, fontWeight: 400, fontFamily: fontFamily, margin: 0 }}>
              {profile.username}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: colors.neutral400, marginTop: '0.125rem' }}>
              <FiImage size={12} />
              <span>JPG, GIF or PNG. Max 2MB.</span>
            </div>
            {profileImage && (
              <button
                onClick={async () => {
                  const user = auth.currentUser;
                  if (user) {
                    const userEmailFormatted = user.email.replace(/\./g, ',');
                    const companyEmailPath = await getFirebaseData(`emailToCompanyDirectory/${userEmailFormatted}`);
                    if (companyEmailPath) {
                      await saveFirebaseData(`Companies/${companyEmailPath}/users/${userEmailFormatted}/profileImage`, null);
                      showToast('Profile picture removed', 'success');
                      window.location.reload();
                    }
                  }
                }}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: '#DC2626',
                  background: 'transparent',
                  border: '1px solid #FCA5A5',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  alignSelf: 'flex-start'
                }}
              >
                Remove Picture
              </button>
            )}
          </div>
        </div>

        <div style={{ height: '1px', backgroundColor: colors.neutral200, width: '100%' }} />

        {/* Form Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* First Name and Last Name */}
          <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
            <div style={{ flex: 1 }}>
              <Input 
                label="First Name"
                value={profile.firstName || ''} 
                onChange={(e) => setProfile(p => ({...p, firstName: e.target.value}))}
                placeholder="Enter your first name"
              />
            </div>
            <div style={{ flex: 1 }}>
              <Input 
                label="Last Name"
                value={profile.lastName || ''} 
                onChange={(e) => setProfile(p => ({...p, lastName: e.target.value}))}
                placeholder="Enter your last name"
              />
            </div>
          </div>
          <p style={{ marginTop: '-0.625rem', fontSize: '0.75rem', fontFamily: fontFamily, color: colors.neutral500 }}>
            Your name as it appears on ID. Used for profile initials display.
          </p>

          {/* Email */}
          <div style={{ width: '100%' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              fontFamily: fontFamily,
              color: '#111',
              marginBottom: '0.375rem'
            }}>
              Email Address
            </label>
            
            <Input 
              type="email" 
              value={isEditingEmail ? tempEmail : profile.email}
              onChange={(e) => setTempEmail(e.target.value)}
              disabled={!isEditingEmail}
              style={!isEditingEmail ? {
                backgroundColor: colors.neutral50,
                color: colors.neutral500,
                borderColor: colors.neutral200
              } : {}}
              rightElement={
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isEditingEmail) {
                      handleSaveEmail();
                    } else {
                      setIsEditingEmail(true);
                    }
                  }} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    padding: 0,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: colors.neutral500,
                    transition: 'color 0.2s',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = '#111';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = colors.neutral500;
                  }}
                >
                  {isEditingEmail ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  )}
                </button>
              }
            />
            
            {isEditingEmail ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <Button 
                  variant="ghost" 
                  onClick={() => setIsEditingEmail(false)} 
                  style={{ fontSize: '0.75rem', height: '1.75rem', padding: '0 0.75rem' }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <p style={{ marginTop: '0.375rem', fontSize: '0.75rem', fontFamily: fontFamily, color: colors.neutral500 }}>
                Used for notifications and login.
              </p>
            )}
          </div>

          {/* Username */}
          <div style={{ width: '100%' }}>
            <Input 
              label="Username"
              value={profile.username} 
              onChange={(e) => setProfile(p => ({...p, username: e.target.value}))}
            />
            <p style={{ marginTop: '0.375rem', fontSize: '0.75rem', fontFamily: fontFamily, color: colors.neutral500 }}>
              This is how your name appears to other team members.
            </p>
          </div>

          {/* Bio */}
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.375rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#111',
                margin: 0
              }}>
                Bio
              </label>
              <span style={{ fontSize: '0.75rem', fontFamily: fontFamily, color: colors.neutral400 }}>
                {profile.bio.length}/200
              </span>
            </div>
            
            <textarea
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                backgroundColor: colors.white,
                border: `1px solid ${colors.neutral300}`,
                borderRadius: '0.5rem',
                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                fontSize: '0.875rem',
                fontFamily: fontFamily,
                color: '#111',
                minHeight: '100px',
                resize: 'none',
                transition: 'all 0.2s',
                outline: 'none'
              }}
              value={profile.bio}
              onChange={(e) => {
                if (e.target.value.length <= 200) {
                  setProfile(p => ({...p, bio: e.target.value}));
                }
              }}
              onFocus={(e) => {
                e.target.style.borderColor = colors.neutral400;
                e.target.style.boxShadow = '0 1px 2px 0 rgb(0 0 0 / 0.05)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = colors.neutral300;
                e.target.style.boxShadow = '0 1px 2px 0 rgb(0 0 0 / 0.05)';
              }}
            />
            <p style={{ marginTop: '0.375rem', fontSize: '0.75rem', fontFamily: fontFamily, color: colors.neutral500 }}>
              A brief description about yourself (max 200 characters).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Security Section Component - Exact match to reference
const SecuritySection = ({ 
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  handlePasswordSubmit
}) => {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [strength, setStrength] = useState(0);
  const [strengthLabel, setStrengthLabel] = useState('');
  const [strengthColor, setStrengthColor] = useState(colors.neutral200);

  useEffect(() => {
    let s = 0;
    if (newPassword.length >= 8) s += 1;
    if (/[A-Z]/.test(newPassword)) s += 1;
    if (/[a-z]/.test(newPassword)) s += 1;
    if (/[0-9]/.test(newPassword)) s += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) s += 1;
    if (newPassword.length > 12) s += 1;
    
    setStrength(s);
    
    // Set label and color based on strength (max 5 criteria, but we show 4 bars)
    const strengthLevel = Math.min(s, 4); // Cap at 4 for display
    
    if (s === 0) {
      setStrengthLabel('');
      setStrengthColor(colors.neutral200);
    } else if (s <= 2) {
      setStrengthLabel('Weak');
      setStrengthColor('#ef4444'); // red
    } else if (s === 3) {
      setStrengthLabel('Fair');
      setStrengthColor('#f59e0b'); // amber
    } else if (s === 4) {
      setStrengthLabel('Good');
      setStrengthColor('#3b82f6'); // blue
    } else {
      setStrengthLabel('Strong');
      setStrengthColor('#10b981'); // green
    }
  }, [newPassword]);

  // Calculate password strength for canSave
  const calculateStrength = (pwd) => {
    let s = 0;
    if (pwd.length >= 8) s += 1;
    if (/[A-Z]/.test(pwd)) s += 1;
    if (/[a-z]/.test(pwd)) s += 1;
    if (/[0-9]/.test(pwd)) s += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) s += 1;
    return s;
  };

  const canSave = currentPassword && 
                  newPassword && 
                  confirmPassword === newPassword && 
                  newPassword.length >= 8 &&
                  calculateStrength(newPassword) >= 3 &&
                  currentPassword !== newPassword;

  const PasswordToggle = ({ visible, onToggle }) => (
    <button 
      type="button"
      onClick={onToggle}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: colors.neutral400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.25rem'
      }}
      onMouseEnter={(e) => e.target.style.color = colors.neutral600}
      onMouseLeave={(e) => e.target.style.color = colors.neutral400}
      tabIndex={-1}
    >
      {visible ? <HiEyeOff size={16} /> : <HiEye size={16} />}
    </button>
  );

  return (
    <div style={{ maxWidth: '42rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h2 style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            fontFamily: fontFamily,
            color: '#111',
            letterSpacing: '-0.01em',
            margin: 0
          }}>
            Security
          </h2>
        </div>

        <div style={{ height: '1px', backgroundColor: colors.neutral200, width: '100%' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Input 
            label="Current Password" 
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            rightElement={<PasswordToggle visible={showCurrent} onToggle={() => setShowCurrent(!showCurrent)} />}
          />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Input 
              label="New Password" 
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              rightElement={<PasswordToggle visible={showNew} onToggle={() => setShowNew(!showNew)} />}
            />
            
            {/* Password Strength Indicator */}
            {newPassword.length > 0 && (
              <div style={{
                marginTop: '0.75rem',
                padding: '0.75rem',
                backgroundColor: colors.neutral50,
                borderRadius: '0.5rem',
                border: `1px solid ${colors.neutral200}`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.5rem'
                }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontFamily: fontFamily,
                    fontWeight: 500,
                    color: colors.neutral700
                  }}>
                    Password Strength
                  </span>
                  {strengthLabel && (
                    <span style={{
                      fontSize: '0.75rem',
                      fontFamily: fontFamily,
                      fontWeight: 600,
                      color: strengthColor
                    }}>
                      {strengthLabel}
                    </span>
                  )}
                </div>
                
                {/* Strength Bars */}
                <div style={{
                  display: 'flex',
                  gap: '0.375rem',
                  height: '6px',
                  width: '100%',
                  backgroundColor: colors.neutral200,
                  borderRadius: '3px',
                  padding: '2px',
                  overflow: 'hidden'
                }}>
                  {[...Array(4)].map((_, i) => {
                    const isActive = i < Math.min(strength, 4);
                    let barColor = colors.neutral200;
                    if (strength <= 2 && isActive) barColor = '#ef4444'; // red
                    else if (strength === 3 && isActive) barColor = '#f59e0b'; // amber
                    else if (strength === 4 && isActive) barColor = '#3b82f6'; // blue
                    else if (strength >= 5 && isActive) barColor = '#10b981'; // green
                    
                    return (
                      <div 
                        key={i}
                        style={{
                          flex: 1,
                          height: '100%',
                          borderRadius: '2px',
                          backgroundColor: isActive ? barColor : 'transparent',
                          transition: 'all 0.3s ease',
                          transform: isActive ? 'scaleY(1)' : 'scaleY(0.5)',
                          transformOrigin: 'center'
                        }}
                      />
                    );
                  })}
                </div>
                
                {/* Requirements Checklist */}
                <div style={{
                  marginTop: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.375rem'
                }}>
                  {[
                    { check: newPassword.length >= 8, text: 'At least 8 characters' },
                    { check: /[A-Z]/.test(newPassword), text: 'One uppercase letter' },
                    { check: /[a-z]/.test(newPassword), text: 'One lowercase letter' },
                    { check: /[0-9]/.test(newPassword), text: 'One number' },
                    { check: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword), text: 'One special character' }
                  ].map((req, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.75rem',
                      fontFamily: fontFamily,
                      color: req.check ? colors.neutral600 : colors.neutral400
                    }}>
                      <span style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        border: `2px solid ${req.check ? strengthColor : colors.neutral300}`,
                        backgroundColor: req.check ? strengthColor : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.2s ease'
                      }}>
                        {req.check && (
                          <span style={{
                            color: 'white',
                            fontSize: '10px',
                            lineHeight: 1,
                            fontWeight: 'bold'
                          }}>✓</span>
                        )}
                      </span>
                      <span style={{
                        textDecoration: req.check ? 'none' : 'none',
                        transition: 'color 0.2s ease'
                      }}>
                        {req.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Input 
            label="Confirm New Password" 
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            rightElement={<PasswordToggle visible={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />}
            style={confirmPassword && newPassword !== confirmPassword ? { borderColor: colors.neutral400 } : {}}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
            <Button 
              disabled={!canSave} 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handlePasswordSubmit(e);
              }}
            >
              Update Password
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function AccountSettingsModal({ isOpen, onClose }) {
  const modalRef = useRef(null);
  const { userProfile, refreshUserProfile } = useAuth();
  
  // Initialize profile from context
  const [profile, setProfile] = useState({
    name: '',
    username: '',
    email: '',
    bio: '',
    firstName: '',
    lastName: ''
  });
  const [profileImage, setProfileImage] = useState(null);
  const [pendingProfileImage, setPendingProfileImage] = useState(null); // Store image until Save is clicked
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [companyEmail, setCompanyEmail] = useState(null);
  const [activeTab, setActiveTab] = useState(SettingsTab.Profile);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [tempEmail, setTempEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Handle modal close - reset pending image
  const handleClose = () => {
    setPendingProfileImage(null);
    // Reset profile image to the saved one from context
    setProfileImage(userProfile.profileImage);
    onClose();
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, userProfile.profileImage]);

  // Listeners are now handled by AuthContext

  // Handle escape key
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      // Blur any focused element to remove focus outline
      const blurAll = () => {
        if (document.activeElement && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        // Also blur the modal container if it somehow got focus
        if (modalRef.current) {
          modalRef.current.blur();
        }
        // Blur the outer container
        const outerContainer = document.querySelector('[data-account-settings-modal]');
        if (outerContainer && outerContainer instanceof HTMLElement) {
          outerContainer.blur();
        }
      };
      // Blur immediately and after a short delay to catch any delayed focus
      blurAll();
      setTimeout(blurAll, 0);
      setTimeout(blurAll, 10);
      setTimeout(blurAll, 50);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  // Sync profile from AuthContext
  useEffect(() => {
    if (userProfile.email) {
      const fullName = userProfile.firstName && userProfile.lastName 
        ? `${userProfile.firstName} ${userProfile.lastName}` 
        : userProfile.firstName || userProfile.username || userProfile.email.split('@')[0];
      
      // Preserve the actual username from userProfile - don't override it with name
      const actualUsername = userProfile.username || userProfile.email.split('@')[0];
      
      setProfile({
        name: fullName,
        username: actualUsername,
        email: userProfile.email,
        bio: userProfile.bio || '',
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || ''
      });
      setTempEmail(userProfile.email);
      setCompanyEmail(userProfile.companyEmail);
      setProfileImage(userProfile.profileImage);
      setIsLoggedIn(true);
    } else {
      setProfile({
        name: '',
        username: '',
        email: '',
        bio: '',
        firstName: '',
        lastName: ''
      });
      setCompanyEmail(null);
      setProfileImage(null);
      setIsLoggedIn(false);
    }
  }, [userProfile]);

  // Profile image is now synced from context in the main useEffect above

  const handleSave = async () => {
    setIsSaving(true);
    const user = auth.currentUser;
    if (user) {
      try {
        const mainCompanyEmail = await getMainCompanyEmail();
        const userEmail = user.email.replace(".", ",");

        // Save profile image if it was changed
        if (pendingProfileImage) {
          await saveProfileImageToFirebase(pendingProfileImage);
          setPendingProfileImage(null); // Clear pending image
        }

        // Save firstName and lastName separately
        const firstNameValue = profile.firstName?.trim() || null;
        const lastNameValue = profile.lastName?.trim() || null;
        
        await saveFirebaseData(
          `Companies/${mainCompanyEmail}/users/${userEmail}/firstName`, 
          firstNameValue
        );
        
        await saveFirebaseData(
          `Companies/${mainCompanyEmail}/users/${userEmail}/lastName`, 
          lastNameValue
        );

        // Update the name field to firstName + lastName (or fallback to username) for backward compatibility
        const displayName = firstNameValue && lastNameValue 
          ? `${firstNameValue} ${lastNameValue}` 
          : firstNameValue || profile.username || user.email.split('@')[0];
        
        await updateProfile(user, { displayName: displayName });
        await saveFirebaseData(`Companies/${mainCompanyEmail}/users/${userEmail}/name`, displayName);

        // Always save username separately to preserve it (don't overwrite with firstName/lastName)
        if (profile.username) {
          await saveFirebaseData(`Companies/${mainCompanyEmail}/users/${userEmail}/username`, profile.username);
        }

        // Save bio
        if (profile.bio !== undefined) {
          await saveFirebaseData(`Companies/${mainCompanyEmail}/users/${userEmail}/bio`, profile.bio);
        }

        showToast('Changes saved successfully!', 'success');
        
        // Refresh context to sync changes everywhere
        await refreshUserProfile();
        
        setTimeout(() => {
          setIsSaving(false);
          onClose();
        }, 500);
      } catch (error) {
        console.error('Error saving profile:', error);
        showToast('Failed to save changes', 'error');
        setIsSaving(false);
      }
    }
  };

  const handleSaveEmail = async () => {
    // Email change requires reauthentication - for now just show a message
    showToast('Email changes require reauthentication. Please contact support.', 'info');
    setIsEditingEmail(false);
    setTempEmail(profile.email);
  };

  const handlePasswordSubmit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const user = auth.currentUser;
    if (!user) {
      showToast("You must be logged in to change your password", "error");
      return;
    }

    // Check if user is a Google user (can't change password)
    const isGoogleUser = user.providerData.some(provider => provider.providerId === 'google.com');
    if (isGoogleUser) {
      showToast("Google users cannot change their password here", "error");
      return;
    }

    // Validation
    if (!currentPassword) {
      showToast("Please enter your current password", "error");
      return;
    }

    if (!newPassword) {
      showToast("Please enter a new password", "error");
      return;
    }

    if (newPassword.length < 8) {
      showToast("Password must be at least 8 characters long", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match", "error");
      return;
    }

    if (currentPassword === newPassword) {
      showToast("New password must be different from current password", "error");
      return;
    }

    // Check password strength
    let strengthCount = 0;
    if (newPassword.length >= 8) strengthCount += 1;
    if (/[A-Z]/.test(newPassword)) strengthCount += 1;
    if (/[a-z]/.test(newPassword)) strengthCount += 1;
    if (/[0-9]/.test(newPassword)) strengthCount += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) strengthCount += 1;
    
    if (strengthCount < 3) {
      showToast("Password is too weak. Please use a stronger password.", "error");
      return;
    }

    try {
      // Reauthenticate user with current password
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );

      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, newPassword);
      
      showToast("Password updated successfully!", "success");
      
      // Clear form fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
    } catch (error) {
      console.error("Password update error:", error);
      
      // Handle specific error cases
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        showToast("Current password is incorrect", "error");
      } else if (error.code === 'auth/weak-password') {
        showToast("Password is too weak. Please choose a stronger password.", "error");
      } else if (error.code === 'auth/requires-recent-login') {
        showToast("For security, please log out and log back in before changing your password", "error");
      } else {
        showToast(error.message || "Failed to update password. Please try again.", "error");
      }
    }
  };

  const handleProfileImageChange = async (e) => {
    const file = e.target.files[0];

    if (file) {
      if (!file.type.match('image.*')) {
        showToast('File is not an image', 'error');
        return;
      }

      try {
        // Compress the image
        const compressedDataURL = await compressImage(file, {
          maxWidth: 300,
          maxHeight: 300,
          quality: 0.8,
          maxSizeKB: 100
        });

        // Store compressed image for preview (don't save to Firebase yet)
        setPendingProfileImage(compressedDataURL);
        setProfileImage(compressedDataURL); // Update preview only

        showToast('Image ready. Click Save to apply changes.', 'info');
      } catch (error) {
        console.error('Error processing image:', error);
        showToast('Error processing image file', 'error');
      }
    }
  };

  const saveProfileImageToFirebase = async (compressedBase64Image) => {
    const user = auth.currentUser;
    if (user) {
      const userEmailFormatted = user.email.replace('.', ',');
      let companyEmailPath = null;

      try {
        companyEmailPath = await getFirebaseData(`emailToCompanyDirectory/${userEmailFormatted}`);
        if (!companyEmailPath) {
          showToast('Failed to save profile image: Company email not found.', 'error');
          return;
        }
      } catch (error) {
        console.error('Error fetching company email:', error);
        showToast('Failed to save profile image: Error getting company info.', 'error');
        return;
      }

      const firebasePath = `Companies/${companyEmailPath}/users/${userEmailFormatted}/profileImage`;

      try {
        await saveFirebaseData(firebasePath, compressedBase64Image);
        
        // Dispatch event to update context and other components
        window.dispatchEvent(new CustomEvent('profileImageUpdated', { 
          detail: { 
            email: user.email,
            imageUrl: compressedBase64Image 
          } 
        }));
      } catch (error) {
        console.error('Error saving profile image:', error);
        throw error;
      }
    } else {
      throw new Error('User not logged in');
    }
  };

  if (!isOpen) return null;

  // Icon components matching ChatSidebar style (inline SVG)
  const ProfileIcon = ({ size = 18, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" style={{ flexShrink: 0 }}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  );

  const SecurityIcon = ({ size = 18, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" style={{ flexShrink: 0 }}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    </svg>
  );

  const navItems = [
    { id: SettingsTab.Profile, icon: ProfileIcon, label: 'Profile' },
    { id: SettingsTab.Security, icon: SecurityIcon, label: 'Security' },
  ];

  return (
    <div 
      data-account-settings-modal
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        outline: 'none'
      }}
      tabIndex={-1}
    >
      {/* Backdrop */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          transition: 'opacity 0.2s',
          outline: 'none'
        }}
        onClick={handleClose}
        tabIndex={-1}
      />

      {/* Modal Container */}
      <div 
        ref={modalRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '900px',
          height: '60vh',
          maxHeight: '650px',
          backgroundColor: colors.white,
          borderRadius: '12px',
          boxShadow: '0 10px 24px rgba(0,0,0,0.10)',
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
          borderWidth: '0',
          borderStyle: 'none',
          borderColor: 'transparent',
          animation: 'modalEnter 0.2s ease-out forwards',
          outline: 'none'
        }}
        tabIndex={-1}
      >
        
        {/* Mobile Header / Close */}
        <button 
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            zIndex: 50,
            padding: '0.5rem',
            color: colors.neutral400,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '9999px',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none'
          }}
          onMouseEnter={(e) => e.target.style.color = colors.neutral900}
          onMouseLeave={(e) => e.target.style.color = colors.neutral400}
          onFocus={(e) => e.target.blur()}
        >
          <HiX size={20} />
        </button>

        {/* Sidebar */}
        <div style={{
          width: '220px',
          backgroundColor: '#fafafa',
          borderRight: `1px solid ${colors.neutral200}`,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}>
          <div style={{ padding: '1.25rem', paddingBottom: '0.5rem' }}>
            <h1 style={{
              fontSize: '1rem',
              fontWeight: 600,
              fontFamily: fontFamily,
              color: '#111',
              letterSpacing: '-0.01em',
              margin: 0
            }}>
              Settings
            </h1>
          </div>
          
          <nav style={{
            flex: 1,
            padding: '0 0.75rem',
            marginTop: '0.5rem',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
          className="hide-scrollbar">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              const iconColor = isActive ? '#111' : colors.neutral400;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    fontFamily: fontFamily,
                    borderRadius: '10px',
                    transition: 'all 0.2s',
                    background: isActive ? '#f5f5f5' : 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: isActive ? '#111' : colors.neutral500
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.target.style.backgroundColor = '#f5f5f5';
                      e.target.style.color = '#111';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.target.style.backgroundColor = 'transparent';
                      e.target.style.color = colors.neutral500;
                    }
                  }}
                >
                  <Icon size={18} color={iconColor} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* User Identity Section */}
          <div style={{
            padding: '1rem',
            borderTop: `1px solid ${colors.neutral200}`,
            backgroundColor: '#F4F4F5'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '2rem',
                height: '2rem',
                borderRadius: '9999px',
                backgroundColor: profileImage ? colors.neutral300 : (profile.email 
                  ? `hsl(${(profile.email.charCodeAt(0) * 10) % 360}, 60%, 70%)`
                  : colors.neutral300),
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                {profileImage ? (
                  <img src={profileImage} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: 'white',
                    textTransform: 'uppercase'
                  }}>
                    {(() => {
                      const firstInitial = profile.firstName && profile.firstName.trim() ? profile.firstName.trim()[0].toUpperCase() : '';
                      const lastInitial = profile.lastName && profile.lastName.trim() ? profile.lastName.trim()[0].toUpperCase() : '';
                      
                      if (firstInitial && lastInitial) {
                        return firstInitial + lastInitial;
                      } else if (firstInitial) {
                        return firstInitial + firstInitial;
                      } else if (profile.email) {
                        // Fallback to first letter of email
                        return profile.email[0].toUpperCase();
                      }
                      return 'U';
                    })()}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 400,
                  fontFamily: fontFamily,
                  color: colors.neutral500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: '1.2',
                  marginBottom: '0.125rem'
                }}>
                  {profile.email}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  fontFamily: fontFamily,
                  color: '#111',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: '1.2'
                }}>
                  {profile.firstName && profile.lastName 
                    ? `${profile.firstName} ${profile.lastName}` 
                    : profile.firstName || profile.username || profile.email?.split('@')[0] || 'User'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          backgroundColor: colors.white
        }}>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
          className="hide-scrollbar">
            {activeTab === SettingsTab.Profile && (
              <ProfileSection
                profile={profile}
                setProfile={setProfile}
                profileImage={profileImage}
                onProfileImageChange={handleProfileImageChange}
                isEditingEmail={isEditingEmail}
                setIsEditingEmail={setIsEditingEmail}
                tempEmail={tempEmail}
                setTempEmail={setTempEmail}
                handleSaveEmail={handleSaveEmail}
              />
            )}
            {activeTab === SettingsTab.Security && (
              <SecuritySection
                currentPassword={currentPassword}
                setCurrentPassword={setCurrentPassword}
                newPassword={newPassword}
                setNewPassword={setNewPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
                handlePasswordSubmit={handlePasswordSubmit}
              />
            )}
          </div>

          {/* Sticky Footer */}
          <div style={{
            borderTop: `1px solid ${colors.neutral200}`,
            padding: '1rem 1.5rem',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            backgroundColor: colors.white
          }}>
            <Button 
              variant="primary" 
              onClick={handleSave} 
              isLoading={isSaving} 
              style={{ fontSize: '0.75rem', paddingLeft: '1.25rem', paddingRight: '1.25rem' }}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modalEnter {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        [data-account-settings-modal],
        [data-account-settings-modal] *,
        [data-account-settings-modal] *:focus,
        [data-account-settings-modal] *:focus-visible,
        [data-account-settings-modal] *:focus-within {
          outline: none !important;
          outline-width: 0 !important;
          outline-style: none !important;
          outline-color: transparent !important;
          box-shadow: none !important;
        }
        [data-account-settings-modal] button:focus,
        [data-account-settings-modal] button:focus-visible,
        [data-account-settings-modal] input:focus,
        [data-account-settings-modal] input:focus-visible,
        [data-account-settings-modal] textarea:focus,
        [data-account-settings-modal] textarea:focus-visible {
          outline: none !important;
          outline-width: 0 !important;
          outline-style: none !important;
          outline-color: transparent !important;
        }
      `}</style>
    </div>
  );
}
