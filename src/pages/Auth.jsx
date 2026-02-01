import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { firebaseLogin, firebaseCreateAccount, showToast, finishSignUp, getFirebaseData, saveFirebaseData, saveBetaAccessRequest, acceptProjectInviteCode } from '../funcs';
import { sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth } from '../firebase-init';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineUser, HiOutlineKey, HiOutlineEye, HiOutlineEyeOff, HiOutlineLogin, HiOutlineUserAdd, HiPhone, HiOutlinePhone } from 'react-icons/hi';

const functions = getFunctions();
const checkEmailProviders = httpsCallable(functions, "checkEmailProviders");

export default function Auth({ embedded = false }) {
  const location = useLocation();
  const [formID, setFormID] = useState("loginForm");
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showGoogleSignup, setShowGoogleSignup] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordField, setShowPasswordField] = useState(false); // Hide password field by default on login
  const [checkingEmail, setCheckingEmail] = useState(false);

  // Preload background image to prevent flash when navigating to this page
  useEffect(() => {
    const img = new Image();
    // Preload with absolute path - CSS uses relative path from styles/main.css
    img.src = window.location.origin + '/styles/back.jpg';
    
    // Also try alternative paths in case of different setups
    const img2 = new Image();
    img2.src = '/styles/back.jpg';
    
    // Force load by setting crossOrigin (helps with caching)
    img.crossOrigin = 'anonymous';
    img2.crossOrigin = 'anonymous';
  }, []);

  // Handle email and inviteToken query parameters from email invites
  useEffect(() => {
    // Parse query parameters from URL (works with HashRouter via location.search)
    const params = new URLSearchParams(location.search);
    const emailParam = params.get('email');
    const inviteTokenParam = params.get('inviteToken');

    if (emailParam) {
      // Pre-fill email field
      setEmail(emailParam.trim().toLowerCase());
      
      // If there's an inviteToken, store it (we'll process it after signup)
      // Note: The pending invite is already stored in Firebase, but we can use this for reference
      if (inviteTokenParam) {
        localStorage.setItem('pendingEmailInviteToken', inviteTokenParam);
      }
      
      // Switch to signup form if email is provided (user is being invited)
      if (formID === 'loginForm') {
        setFormID('signupForm');
      }
    }
  }, [location.search, formID]);

  // Handle Continue button - check email with Cloud Function
  const handleContinue = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !email.trim()) {
      setError('Please enter your email address');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setCheckingEmail(true);
    try {
      const result = await checkEmailProviders({ email: email.trim() });
      const data = result.data;
      
      if (data.exists && data.providers && data.providers.includes('google.com')) {
        // Email is registered with Google account - automatically trigger Google sign-in
        showToast('This email uses Google sign-in. Signing in...', 'info');
        setShowPasswordField(false);
        // Small delay to show the toast, then trigger Google sign-in
        setTimeout(() => {
          handleGoogleSignIn();
        }, 300);
      } else {
        // Email not registered or registered with password - show password field
        setShowPasswordField(true);
      }
    } catch (error) {
      console.error('Error checking email:', error);
      // On error, show password field as fallback
      setShowPasswordField(true);
    } finally {
      setCheckingEmail(false);
    }
  };

  // TEST: Delete specific Firebase path
  const handleTestDeleteCompany = async () => {
    try {
      const confirmed = window.confirm('Delete Companies/jaydabhou1@gmail,com from Firebase? This cannot be undone.');
      if (!confirmed) return;
      await saveFirebaseData('Companies/jaydabhou1@gmail,com', null);
      await saveFirebaseData('users/on9Sa23T8oSbrGuED86fMYUA2Nl1', null);
      await saveFirebaseData('emailToCompanyDirectory/jaydabhou1@gmail,com', null);
      showToast('Deleted test company data.', 'success');
    } catch (e) {
      console.error('Test delete failed:', e);
      showToast('Failed to delete test data', 'error');
    }
  };

  const handleSubmit = async (e) => {   
    e.preventDefault();
    setError('');

    try {
      if (formID == "loginForm") {
        // Login flowwalma
        await firebaseLogin(email, password);
        // Redirect or handle successful login
      } else if (formID == "signupForm") {
        // Signup flow
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }

        const user = await firebaseCreateAccount(email, password, inviteCode, null, firstName.trim() || null, lastName.trim() || null);
        // Show success toast message
     //   window.alert('Account created successfully! Page is reloading...');
        // The redirect happens inside firebaseCreateAccount function
      }
      else if (formID == "forgotPasswordForm") {
        await sendPasswordResetEmail(auth, email);
        showToast("Password reset email sent! Please check your inbox.", "success");
        setFormID("loginForm"); // Return to login form after sending reset email
      }
    } catch (err) {
      setError(err.message || 'An error occurred during authentication');
      console.error(err);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    const provider = new GoogleAuthProvider();
    if (email && email.trim()) {
      provider.setCustomParameters({
        login_hint: email.trim(),
        prompt: "none"

      });
    }
    try {
      const result = await signInWithPopup(auth, provider);
      if (result && result.user) {
        const user = result.user;
        
        // Check if this is a new user (first time signing in with Google)
        // by checking if they exist in the emailToCompanyDirectory
        let isNewUser = false;
        let existingUserData = null;
        try {
          const emailPath = user.email.replace(/\./g, ',');
          console.log('[Google Sign-In] Checking for existing user:', emailPath);
          const existingCompany = await getFirebaseData(`emailToCompanyDirectory/${emailPath}`);
          console.log('[Google Sign-In] Existing company:', existingCompany);
          
          if (existingCompany) {
            // User exists, get their data to check onboarding status
            existingUserData = await getFirebaseData(`Companies/${existingCompany}/users/${emailPath}`);
            console.log('[Google Sign-In] Existing user data:', existingUserData);
            isNewUser = false;
          } else {
            console.log('[Google Sign-In] No existing company found - new user');
            isNewUser = true;
          }
        } catch (e) {
          console.error('[Google Sign-In] Error checking user:', e);
          // If we can't check, assume it's a new user to be safe
          isNewUser = true;
        }
        
        // Parse Google displayName into firstName and lastName
        let googleFirstName = null;
        let googleLastName = null;
        if (user.displayName) {
          const nameParts = user.displayName.trim().split(/\s+/);
          if (nameParts.length > 0) {
            googleFirstName = nameParts[0];
            if (nameParts.length > 1) {
              // Join all remaining parts as lastName (handles middle names)
              googleLastName = nameParts.slice(1).join(' ');
            }
          }
        }
        
        // Save beta access request for new users
        if (isNewUser) {
          await saveBetaAccessRequest(user.email, user.displayName || '');
        }
        
        showToast("Signed in with Google!", "success");
        
        // Process pending project invite code if exists (similar to firebaseCreateAccount)
        const pendingInviteCode = localStorage.getItem('pendingProjectInviteCode');
        if (pendingInviteCode) {
          console.log('Processing pending project invite code:', pendingInviteCode);
          localStorage.removeItem('pendingProjectInviteCode');
          try {
            await acceptProjectInviteCode(pendingInviteCode);
          } catch (err) {
            console.error('Failed to accept pending project invite:', err);
            // Continue with signup even if invite acceptance fails
          }
        }
        
        // Only call finishSignUp for new users, existing users just need to redirect
        if (isNewUser) {
          console.log('[Google Sign-In] New user - calling finishSignUp');
          finishSignUp(user, user.displayName || null, user.email || null, user.email || null, googleFirstName, googleLastName);
        } else {
          // Existing user - check onboarding status and redirect accordingly
          console.log('[Google Sign-In] Existing user - checking onboarding status');
          console.log('[Google Sign-In] Onboarding completed:', existingUserData?.onboardingCompleted);
          
          if (existingUserData && existingUserData.onboardingCompleted) {
            console.log('[Google Sign-In] Onboarding complete - redirecting to demonstration');
            window.location.href = '/#/demonstration';
          } else {
            console.log('[Google Sign-In] Onboarding not complete - redirecting to onboarding');
            window.location.href = '/#/onboarding';
          }
        }
      }
      else{
        showToast("Google sign-in failed", "error");
      }
    } catch (error) {
      setError(error.message || "Google sign-in failed");
      showToast(error.message || "Google sign-in failed", "error");
    }
  };

  return (
    <div className="auth-container" style={embedded ? { 
      minHeight: '100%',
      height: '100%',
    } : {}}>
      <img 
        src="/extension/reallogo.png" 
        alt="Phraze Logo" 
        className="auth-logo-top"
      />
      <div className="auth-form-container">
        <div className="auth-card">
          {/* Header */}
          <div className="auth-header">
            <h1 className="auth-title">
              {(() => {
                switch (formID) {
                  case `loginForm`:
                    return 'Welcome back';
                  case 'signupForm':
                    return 'Create an account';
                  case `forgotPasswordForm`:
                    return 'Reset your password';
                  default:
                    return 'Welcome back';
                }
              })()}
            </h1>
            <p className="auth-subtitle">
              {(() => {
                switch (formID) {
                  case `loginForm`:
                    return 'Enter your details to access your account.';
                  case 'signupForm':
                    return 'Enter your details to create your account.';
                  case `forgotPasswordForm`:
                    return 'Enter your email to receive a password reset link.';
                  default:
                    return 'Enter your details to access your account.';
                }
              })()}
            </p>
          </div>

          {/* Pill Toggle */}
          {formID !== 'forgotPasswordForm' && (
            <div className="auth-toggle">
              <button 
                className={`toggle-btn ${formID === 'loginForm' ? 'active' : ''}`}
                onClick={() => {
                  setFormID('loginForm');
                  setShowPasswordField(false);
                  setPassword('');
                }}
                type="button"
              >
                Sign in
              </button>
              <button 
                className={`toggle-btn ${formID === 'signupForm' ? 'active' : ''}`}
                onClick={() => {
                  setFormID('signupForm');
                  setShowPasswordField(false);
                  setPassword('');
                }}
                type="button"
              >
                Sign up
              </button>
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>

            {formID == `signupForm` && (
              <div className="form-group">
                <label className="form-label">Project Invite Code</label>
                <input
                  type="text"
                  id="invite-code"
                  className="form-input"
                  placeholder="Project Invite Code (Optional)"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                />
              </div>
            )}

            {formID == `signupForm` && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Jane"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required={formID == `signupForm`}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required={formID == `signupForm`}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  // Reset password field visibility when email changes
                  if (showPasswordField) {
                    setShowPasswordField(false);
                  }
                }}
                required
              />
            </div>

            {formID != `forgotPasswordForm` && formID === 'loginForm' && showPasswordField && (
              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="form-input password-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <HiOutlineEyeOff /> : <HiOutlineEye />}
                  </button>
                </div>
              </div>
            )}

            {formID != `forgotPasswordForm` && formID === 'signupForm' && (
              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="form-input password-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <HiOutlineEyeOff /> : <HiOutlineEye />}
                  </button>
                </div>
              </div>
            )}

            {formID == `signupForm` && (
              <div className="form-group">
                <label className="form-label">Confirm password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    className="form-input password-input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required={formID == `signupForm`}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <HiOutlineEyeOff /> : <HiOutlineEye />}
                  </button>
                </div>
              </div>
            )}
            {formID == 'loginForm' && showPasswordField && (
              <div className="forgot-password-link" onClick={() => setFormID(`forgotPasswordForm`)}>
                Forgot password?
              </div>
            )}

            {/* Show Continue button on login form when password field is hidden, otherwise show Submit */}
            {formID === 'loginForm' && !showPasswordField ? (
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleContinue}
                disabled={checkingEmail || !email || !email.trim()}
              >
                {checkingEmail ? 'Checking...' : 'Continue'}
              </button>
            ) : (
              <button type="submit" className="btn btn-primary">
                {(() => {
                  switch (formID) {
                    case 'loginForm':
                      return 'Sign in';
                    case 'signupForm':
                      return 'Sign up';
                    case 'forgotPasswordForm':
                      return 'Send password reset email';
                    default:
                      return 'Submit';
                  }
                })()}
              </button>
            )}
          </form>

          {formID == 'loginForm' && (
            <>
              <div className="divider">
                <span>OR</span>
              </div>
              
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowGoogleSignup(v => !v)}
              >
                <svg className="google-signup-icon" viewBox="0 0 24 24" style={{ width: '20px', height: '20px', marginRight: '8px' }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              {showGoogleSignup && (
                <div className="google-signup-expanded">
                  <button 
                    className="btn btn-secondary"
                    style={{ marginTop: "1rem" }}
                    onClick={handleGoogleSignIn} 
                    type="button"
                  >
                    <svg className="google-signup-icon" viewBox="0 0 24 24" style={{ width: '20px', height: '20px', marginRight: '8px' }}>
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign up with Google
                  </button>
                </div>
              )}
            </>
          )}

          {formID != "forgotPasswordForm" && (
            <div className="auth-footer">
              {formID == `loginForm` ? (
                <>
                  Don't have an account? 
                  <span className="link" onClick={() => {
                    setFormID('signupForm');
                    setShowPasswordField(false);
                    setPassword('');
                  }}>Sign up</span>
                </>
              ) : (
                <>
                  Already have an account? 
                  <span className="link" onClick={() => {
                    setFormID('loginForm');
                    setShowPasswordField(false);
                    setPassword('');
                  }}>Sign in</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 