import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { auth } from '../firebase-init';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../firebase-init';
import { getFirebaseData, isUserWhitelisted, updateProfilePicture } from '../funcs';
import { initializePresence, cleanupPresence } from '../utils/presence';
import { initializeTyping, cleanupTyping } from '../utils/typing';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // Auth state
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Whitelist state
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [whitelistLoading, setWhitelistLoading] = useState(true);
  
  // User profile state
  const [userProfile, setUserProfile] = useState({
    email: null,
    username: null,
    firstName: null,
    lastName: null,
    bio: null,
    profileImage: null,
    companyEmail: null
  });
  const [profileLoading, setProfileLoading] = useState(true);
  
  // Onboarding state
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(true);
  
  // Refs to prevent duplicate fetches
  const profileFetchedRef = useRef(false);
  const whitelistCheckedRef = useRef(false);
  const whitelistListenerRef = useRef(null);
  
  // Single auth state listener
  useEffect(() => {
    console.log('[AuthContext] Setting up auth listener');
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[AuthContext] Auth state changed:', firebaseUser?.email);
      
      if (firebaseUser) {
        setUser(firebaseUser);
        setIsAuthenticated(true);
        setAuthLoading(false);
        
        // Check whitelist status
        setWhitelistLoading(true);
        
        try {
          const whitelisted = await isUserWhitelisted(firebaseUser.email);
          console.log('[AuthContext] Whitelist status:', whitelisted);
          setIsWhitelisted(whitelisted);
          whitelistCheckedRef.current = true;
          
          // Set up real-time whitelist listener for immediate updates
          setupWhitelistListener(firebaseUser.email);
        } catch (error) {
          console.error('[AuthContext] Error checking whitelist:', error);
          setIsWhitelisted(false);
        } finally {
          setWhitelistLoading(false);
        }
        
        // Fetch user profile data
        await fetchUserProfile(firebaseUser);
        profileFetchedRef.current = true;
        
        // Initialize presence system
        try {
          await initializePresence();
        } catch (error) {
          console.error('[AuthContext] Error initializing presence:', error);
        }
        
        // Initialize typing system
        try {
          await initializeTyping();
        } catch (error) {
          console.error('[AuthContext] Error initializing typing:', error);
        }
      } else {
        // User logged out - reset everything
        console.log('[AuthContext] User logged out, resetting state');
        
        // Clean up presence system
        try {
          cleanupPresence();
        } catch (error) {
          console.error('[AuthContext] Error cleaning up presence:', error);
        }
        
        // Clean up typing system
        try {
          cleanupTyping();
        } catch (error) {
          console.error('[AuthContext] Error cleaning up typing:', error);
        }
        
        setUser(null);
        setIsAuthenticated(false);
        setIsWhitelisted(false);
        setUserProfile({
          email: null,
          username: null,
          firstName: null,
          lastName: null,
          bio: null,
          profileImage: null,
          companyEmail: null
        });
        setOnboardingCompleted(false);
        setAuthLoading(false);
        setWhitelistLoading(false);
        setProfileLoading(false);
        setOnboardingLoading(false);
        profileFetchedRef.current = false;
        whitelistCheckedRef.current = false;
        
        // Clean up whitelist listener
        if (whitelistListenerRef.current) {
          off(whitelistListenerRef.current.ref, 'value', whitelistListenerRef.current.callback);
          whitelistListenerRef.current = null;
        }
      }
    });
    
    return () => {
      console.log('[AuthContext] Cleaning up auth listener');
      unsubscribe();
      // Clean up presence on unmount
      try {
        cleanupPresence();
      } catch (error) {
        console.error('[AuthContext] Error cleaning up presence on unmount:', error);
      }
      // Clean up whitelist listener on unmount
      if (whitelistListenerRef.current) {
        off(whitelistListenerRef.current.ref, 'value', whitelistListenerRef.current.callback);
        whitelistListenerRef.current = null;
      }
    };
  }, []);
  
  // Set up real-time whitelist listener for immediate updates when user gets approved
  const setupWhitelistListener = (userEmail) => {
    // Clean up existing listener
    if (whitelistListenerRef.current) {
      off(whitelistListenerRef.current.ref, 'value', whitelistListenerRef.current.callback);
      whitelistListenerRef.current = null;
    }
    
    const sanitizedEmail = userEmail.replace(/\./g, ',');
    const whitelistPath = `WhitelistedUsers/${sanitizedEmail}`;
    const whitelistRef = ref(database, whitelistPath);
    
    const callback = (snapshot) => {
      const isWhitelisted = snapshot.exists();
      console.log('[AuthContext] Whitelist status changed (real-time):', isWhitelisted);
      setIsWhitelisted(isWhitelisted);
      whitelistCheckedRef.current = true;
    };
    
    onValue(whitelistRef, callback);
    
    // Store ref and callback for cleanup
    whitelistListenerRef.current = {
      ref: whitelistRef,
      callback: callback
    };
  };
  
  // Fetch user profile data from Firebase
  const fetchUserProfile = async (firebaseUser) => {
    if (!firebaseUser) return;
    
    setProfileLoading(true);
    setOnboardingLoading(true);
    
    try {
      const email = firebaseUser.email;
      const sanitizedEmail = email.replace(/\./g, ',');
      
      // Fetch company email
      const companyEmail = await getFirebaseData(`emailToCompanyDirectory/${sanitizedEmail}`);
      console.log('[AuthContext] Company email:', companyEmail);
      
      if (companyEmail) {
        // Fetch user data in parallel
        const [userData, profileImageData] = await Promise.all([
          getFirebaseData(`Companies/${companyEmail}/users/${sanitizedEmail}`),
          getFirebaseData(`Companies/${companyEmail}/users/${sanitizedEmail}/profileImage`)
        ]);
        
        console.log('[AuthContext] User data fetched:', userData);
        
        setUserProfile({
          email: email,
          username: userData?.username || userData?.name || email.split('@')[0],
          firstName: userData?.firstName || null,
          lastName: userData?.lastName || null,
          bio: userData?.bio || null,
          profileImage: profileImageData || null,
          companyEmail: companyEmail
        });
        
        // Check onboarding status
        setOnboardingCompleted(userData?.onboardingCompleted || false);
      } else {
        // No company email found - user might be new
        console.log('[AuthContext] No company email found');
        setUserProfile({
          email: email,
          username: email.split('@')[0],
          firstName: null,
          lastName: null,
          bio: null,
          profileImage: null,
          companyEmail: null
        });
        setOnboardingCompleted(false);
      }
    } catch (error) {
      console.error('[AuthContext] Error fetching user profile:', error);
    } finally {
      setProfileLoading(false);
      setOnboardingLoading(false);
    }
  };
  
  // Set up profile picture listener (single listener for entire app)
  useEffect(() => {
    if (!isAuthenticated || !userProfile.companyEmail) return;
    
    console.log('[AuthContext] Setting up profile picture listener');
    
    const cleanup = updateProfilePicture((imageData) => {
      console.log('[AuthContext] Profile picture updated:', !!imageData);
      setUserProfile(prev => ({
        ...prev,
        profileImage: imageData
      }));
    }, 'AuthContext');
    
    // Listen for custom profileImageUpdated event
    const handleProfileImageUpdate = (event) => {
      console.log('[AuthContext] Received profileImageUpdated event');
      if (event.detail && event.detail.imageUrl) {
        setUserProfile(prev => ({
          ...prev,
          profileImage: event.detail.imageUrl
        }));
      }
    };
    
    window.addEventListener('profileImageUpdated', handleProfileImageUpdate);
    
    return () => {
      console.log('[AuthContext] Cleaning up profile picture listener');
      window.removeEventListener('profileImageUpdated', handleProfileImageUpdate);
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [isAuthenticated, userProfile.companyEmail]);
  
  // Function to manually refresh user profile (e.g., after updating settings)
  const refreshUserProfile = async () => {
    console.log('[AuthContext] Manually refreshing user profile');
    if (user) {
      await fetchUserProfile(user);
    }
  };
  
  // Function to update profile locally (optimistic update)
  const updateUserProfile = (updates) => {
    console.log('[AuthContext] Updating user profile locally:', updates);
    setUserProfile(prev => ({
      ...prev,
      ...updates
    }));
  };
  
  // Function to manually refresh whitelist status (e.g., after approval)
  const refreshWhitelistStatus = async () => {
    if (!user) return;
    
    console.log('[AuthContext] Manually refreshing whitelist status');
    setWhitelistLoading(true);
    
    try {
      const whitelisted = await isUserWhitelisted(user.email);
      console.log('[AuthContext] Updated whitelist status:', whitelisted);
      setIsWhitelisted(whitelisted);
    } catch (error) {
      console.error('[AuthContext] Error refreshing whitelist:', error);
    } finally {
      setWhitelistLoading(false);
    }
  };
  
  const value = {
    // Auth state
    user,
    isAuthenticated,
    authLoading,
    
    // Whitelist state
    isWhitelisted,
    whitelistLoading,
    
    // User profile
    userProfile,
    profileLoading,
    
    // Onboarding
    onboardingCompleted,
    onboardingLoading,
    
    // Actions
    refreshUserProfile,
    updateUserProfile,
    refreshWhitelistStatus,
    
    // Computed values
    isReady: !authLoading && !whitelistLoading && !profileLoading && !onboardingLoading,
    isFullyAuthenticated: isAuthenticated && isWhitelisted && onboardingCompleted
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    // During hot reload, context might temporarily be unavailable
    // Return a safe default object instead of throwing to prevent crashes
    if (process.env.NODE_ENV === 'development') {
      console.warn('useAuth called outside AuthProvider - returning default values');
      return {
        user: null,
        isAuthenticated: false,
        authLoading: true,
        isWhitelisted: false,
        whitelistLoading: true,
        userProfile: {
          email: null,
          username: null,
          firstName: null,
          lastName: null,
          bio: null,
          profileImage: null,
          companyEmail: null
        },
        profileLoading: true,
        onboardingCompleted: false,
        onboardingLoading: true,
        refreshUserProfile: async () => {},
        updateUserProfile: async () => {},
        refreshWhitelistStatus: async () => {},
        isReady: false,
        isFullyAuthenticated: false
      };
    }
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
