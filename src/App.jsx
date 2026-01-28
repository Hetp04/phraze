import { useEffect, useState, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import Preloader from './components/Preloader';
import Home from './pages/Home';
import About from './pages/About';
import Auth from './pages/Auth';
import Demonstration from './pages/Demonstration';
import Profile from './pages/Profile';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import CookiePolicy from './pages/CookiePolicy';
import Contact from './pages/Contact';
import AccessDenied from './pages/AccessDenied';
import Onboarding from './pages/Onboarding';
import Demo from './pages/Demo';
import { ExpandableScreen, ExpandableScreenContent, useExpandableScreen } from './components/ui/expandable-screen.jsx';
import { ExtensionProvider } from './context/ExtensionContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginModalProvider } from './context/LoginModalContext';
import { auth, database } from './firebase-init';
import { onAuthStateChanged } from 'firebase/auth';
import { isUserWhitelisted, getUIState, setUIState, removeUIState, getMainCompanyEmail, getFirebaseData } from './funcs';
import { ALLOW_PUBLIC_DEMONSTRATION_ACCESS } from './config';
import { ref, onValue } from 'firebase/database';

// Component to handle authentication-based redirection
// This component must be rendered inside AuthProvider
function AuthRedirectHandler({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { 
    isAuthenticated, 
    authLoading, 
    isWhitelisted, 
    whitelistLoading, 
    onboardingCompleted, 
    onboardingLoading,
    isReady,
    user
  } = useAuth();
  const previousSharedProjectsRef = useRef(new Set());
  const checkInProgressRef = useRef(false); // Prevent race conditions
  const redirectTimerRef = useRef(null); // Track redirect timer for access-denied page

  // Protected routes that require whitelist access
  const protectedRoutes = ['/demonstration', '/profile'];
  // Routes that don't require onboarding check (onboarding itself and access-denied)
  const onboardingExemptRoutes = ['/onboarding', '/access-denied'];

  useEffect(() => {
    // Wait for auth context to be ready
    if (!isReady) {
      console.log('[AuthRedirect] Waiting for auth context to be ready...');
      return;
    }

    // Prevent race conditions from multiple rapid changes
    if (checkInProgressRef.current) {
      console.log('[AuthRedirect] Check already in progress, skipping...');
      return;
    }
    
    checkInProgressRef.current = true;
      
      if (user) {
      // Check if user is NOT whitelisted first
      if (!isWhitelisted) {
        // User authenticated but not whitelisted
        if (location.pathname === '/auth') {
          // Redirect to access-denied instead of demonstration
          console.log('[AuthRedirect] Not whitelisted, redirecting to /access-denied');
            navigate('/access-denied', { replace: true });
          checkInProgressRef.current = false;
            return;
          }
          
        if (protectedRoutes.includes(location.pathname) || location.pathname === '/onboarding') {
          console.log('[AuthRedirect] Not whitelisted, redirecting to /access-denied');
          navigate('/access-denied', { replace: true });
          checkInProgressRef.current = false;
                  return;
                }
                
        // Allow public pages for non-whitelisted users
        checkInProgressRef.current = false;
                  return;
                }
      
      // User IS whitelisted - normal flow
      if (location.pathname === '/auth') {
        console.log('[AuthRedirect] Logged-in user trying to access /auth, redirecting...');
        navigate('/demonstration', { replace: true });
        checkInProgressRef.current = false;
                return;
              }
          
      // User is whitelisted, redirect away from /access-denied with 2 second delay
      if (location.pathname === '/access-denied') {
        // Clear any existing timer
        if (redirectTimerRef.current) {
          clearTimeout(redirectTimerRef.current);
        }
        
        // Set up 2 second delay before redirecting
        redirectTimerRef.current = setTimeout(() => {
          if (onboardingCompleted) {
            console.log('[AuthRedirect] User whitelisted and onboarding completed, redirecting to /demonstration');
            navigate('/demonstration', { replace: true });
          } else {
            console.log('[AuthRedirect] User whitelisted but onboarding not completed, redirecting to /onboarding');
            navigate('/onboarding', { replace: true });
          }
          redirectTimerRef.current = null;
        }, 2000);
        
        checkInProgressRef.current = false;
        return;
      }
      
      // Check onboarding and protected routes
      if (protectedRoutes.includes(location.pathname) && !onboardingCompleted) {
        // Trying to access protected route without completing onboarding
        console.log('[AuthRedirect] Protected route without onboarding, redirecting to /onboarding');
              navigate('/onboarding', { replace: true });
        checkInProgressRef.current = false;
        return;
      }
      
      if (location.pathname === '/onboarding' && onboardingCompleted) {
        // Already completed onboarding, redirect to demonstration
        console.log('[AuthRedirect] Onboarding already completed, redirecting to /demonstration');
        navigate('/demonstration', { replace: true });
        checkInProgressRef.current = false;
        return;
        }
      } else {
        // User not authenticated
      if (protectedRoutes.includes(location.pathname)) {
        console.log('[AuthRedirect] Not authenticated, redirecting to /auth');
          navigate('/auth', { replace: true });
        checkInProgressRef.current = false;
          return;
        }
      
      if (location.pathname === '/onboarding') {
        console.log('[AuthRedirect] Not authenticated, cannot access onboarding');
        navigate('/auth', { replace: true });
        checkInProgressRef.current = false;
        return;
      }
      
      if (location.pathname === '/demonstration' && !ALLOW_PUBLIC_DEMONSTRATION_ACCESS) {
        navigate('/auth', { replace: true });
        checkInProgressRef.current = false;
        return;
      }
    }
    
    // Mark check as complete
    checkInProgressRef.current = false;
  }, [location.pathname, navigate, isReady, isAuthenticated, isWhitelisted, onboardingCompleted, user]);

  // Cleanup redirect timer on unmount or when navigating away from access-denied
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [location.pathname]);

  // Global listener for shared projects - only show toast for truly new projects
  useEffect(() => {
    if (!isAuthenticated) return;

    const user = auth.currentUser;
    if (!user || !user.email) return;

    const userEmailPath = user.email.replace(/\./g, ',');
    const sharedProjectsRef = ref(database, `emailToSharedProjects/${userEmailPath}`);

    const unsubscribe = onValue(sharedProjectsRef, (snapshot) => {
      const sharedProjectsData = snapshot.val();
      const receivedShared = [];

      if (sharedProjectsData && typeof sharedProjectsData === 'object') {
        for (const [ownerCompany, projects] of Object.entries(sharedProjectsData)) {
          if (projects && typeof projects === 'object') {
            for (const [projectId, projectInfo] of Object.entries(projects)) {
              if (projectInfo && typeof projectInfo === 'object') {
                receivedShared.push({
                  projectId: projectInfo.projectId || projectId,
                  ownerCompany: projectInfo.ownerCompany || ownerCompany,
                  joinedAt: projectInfo.joinedAt
                });
              }
            }
          }
        }
      }

      const currentKeys = new Set(
        receivedShared.map(p => `${p.projectId}-${p.ownerCompany}`)
      );

      // Skip toast on initial load (don't show for projects user is already viewing)
      if (previousSharedProjectsRef.current.size === 0) {
        previousSharedProjectsRef.current = currentKeys;
        return;
      }

      // Find truly new projects (not in previous set)
      const newProjectKeys = new Set();
      currentKeys.forEach(key => {
        if (!previousSharedProjectsRef.current.has(key)) {
          newProjectKeys.add(key);
        }
      });

      if (newProjectKeys.size === 0) {
        previousSharedProjectsRef.current = currentKeys;
        return;
      }

      const newProjects = receivedShared.filter(p => 
        newProjectKeys.has(`${p.projectId}-${p.ownerCompany}`)
      );

      // Don't show toast if user is already viewing this project
      // Check localStorage (synced from Firebase) for immediate comparison
      const currentProject = localStorage.getItem('currentProject');
      const currentSharedProjectId = localStorage.getItem('sharedProjectId');
      const currentSharedCompany = localStorage.getItem('sharedCompanyEmail');
      
      const newestProject = newProjects[0];
      const isAlreadyViewing = currentProject === newestProject.projectId && 
                               currentSharedProjectId === newestProject.projectId &&
                               currentSharedCompany === newestProject.ownerCompany;

      if (isAlreadyViewing) {
        previousSharedProjectsRef.current = currentKeys;
        return;
      }

      // Show toast for new project
      const projectName = newestProject.projectId === 'default' 
        ? 'Default Project' 
        : newestProject.projectId;

      const existingToast = document.querySelector('.toast:not(.toast--scoped)');
      if (existingToast) existingToast.remove();

      const toast = document.createElement('div');
      toast.className = 'toast toast-success';
      toast.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%) translateY(100px); z-index: 2000; opacity: 0; transition: all 0.3s ease;';

      const toastContent = document.createElement('div');
      toastContent.style.cssText = 'display: flex; align-items: center; gap: 12px; width: 100%;';

      const messageText = document.createElement('span');
      messageText.textContent = `You've been added to project: ${projectName}`;
      messageText.style.flex = '1';

      const actionButton = document.createElement('button');
      actionButton.textContent = 'Go to Project';
      actionButton.style.cssText = 'background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.3); color: white; padding: 6px 12px; border-radius: 6px; font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: background 0.2s; white-space: nowrap;';
      
      actionButton.addEventListener('mouseenter', () => {
        actionButton.style.background = 'rgba(255, 255, 255, 0.3)';
      });
      actionButton.addEventListener('mouseleave', () => {
        actionButton.style.background = 'rgba(255, 255, 255, 0.2)';
      });

      let autoSwitchTimeout = null;

      actionButton.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (autoSwitchTimeout) {
          clearTimeout(autoSwitchTimeout);
        }
        
        const pendingData = {
          projectId: newestProject.projectId,
          ownerCompany: newestProject.ownerCompany,
          joinedAt: newestProject.joinedAt || new Date().toISOString()
        };
        
        // Store in Firebase
        if (user && user.email) {
          await setUIState(user.email, 'pendingSharedProject', pendingData);
        }
        
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
        
        if (window.location.hash !== '#/demonstration') {
          window.location.hash = '#/demonstration';
        }
        setTimeout(() => window.location.reload(), 100);
      });

      toastContent.appendChild(messageText);
      toastContent.appendChild(actionButton);
      toast.appendChild(toastContent);
      document.body.appendChild(toast);

      requestAnimationFrame(() => {
        toast.classList.add('show');
        toast.style.transform = 'translateX(-50%) translateY(0)';
        toast.style.opacity = '1';
      });

      autoSwitchTimeout = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 5000);

      previousSharedProjectsRef.current = currentKeys;
    });

    return () => {
      previousSharedProjectsRef.current = new Set();
      unsubscribe();
    };
  }, [isAuthenticated]);

  // Truly public routes that don't require any auth check
  const trulyPublicRoutes = ['/', '/about', '/contact', '/terms', '/privacy', '/cookies'];
  
  // STRICT RENDER GUARD - Don't render anything until context is ready
  if (!isReady) {
    console.log('[AuthRedirect] Waiting for auth context to be ready...');
    return null;
  }

  // === AUTHENTICATED USER LOGIC ===
  if (isAuthenticated) {
    // BLOCK /auth page for logged-in users (they'll be redirected)
    if (location.pathname === '/auth') {
      return null;
    }
    
    // BLOCK /onboarding if already completed (they'll be redirected)
    if (location.pathname === '/onboarding' && onboardingCompleted) {
      return null;
    }
    
    // BLOCK protected routes if onboarding not completed (they'll be redirected)
    if (protectedRoutes.includes(location.pathname) && !onboardingCompleted) {
      return null;
    }
    
    // BLOCK protected routes if not whitelisted (they'll be redirected)
    if ((protectedRoutes.includes(location.pathname) || location.pathname === '/onboarding') && !isWhitelisted) {
      return null;
    }
    
    // Allow rendering for:
    // - Truly public routes
    // - /access-denied page
    // - /onboarding (if not completed and whitelisted)
    // - Protected routes (if onboarding completed and whitelisted)
    return children;
  }

  // === NON-AUTHENTICATED USER LOGIC ===
  // BLOCK /onboarding for non-authenticated users (they'll be redirected to /auth)
  if (location.pathname === '/onboarding') {
    return null;
  }

  // BLOCK protected routes for non-authenticated users (they'll be redirected to /auth)
  if (protectedRoutes.includes(location.pathname)) {
    return null;
  }

  // Allow rendering for:
  // - Truly public routes
  // - /auth page
  return children;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [currentProject, setCurrentProject] = useState('default');
  const [userEmail, setUserEmail] = useState(null);

  // Load currentProject from Firebase on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        setUserEmail(user.email);
        const storedProject = await getUIState(user.email, 'currentProject');
        if (storedProject) {
          setCurrentProject(storedProject);
        }
      } else {
        setUserEmail(null);
        setCurrentProject('default');
      }
    });
    return () => unsubscribe();
  }, []);

  const onProjectChange = async (newProject) => {
    setCurrentProject(newProject);
    if (userEmail) {
      await setUIState(userEmail, 'currentProject', newProject);
    }
  };
  
  useEffect(() => {
    let timer = null;
    
    const checkPreloader = async () => {
      if (userEmail) {
        const hasSeenPreloader = await getUIState(userEmail, 'hasSeenPreloader');
        if (hasSeenPreloader) {
          setLoading(false);
        } else {
          timer = setTimeout(async () => {
            setLoading(false);
            await setUIState(userEmail, 'hasSeenPreloader', true);
          }, 3000);
        }
      } else {
        setLoading(false);
      }
    };
    
    checkPreloader();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [userEmail]);

  function LoginExpandController() {
    const { isExpanded, collapse, animationDuration } = useExpandableScreen();
    const navigate = useNavigate();

    useEffect(() => {
      if (!isExpanded) return;

      const navId = window.setTimeout(() => {
        navigate('/auth');
      }, Math.round(animationDuration * 1000));

      const collapseId = window.setTimeout(() => {
        collapse();
      }, Math.round(animationDuration * 1000) + 220);

      return () => {
        window.clearTimeout(navId);
        window.clearTimeout(collapseId);
      };
    }, [animationDuration, collapse, isExpanded, navigate]);

    return null;
  }

  return (
    <ExtensionProvider>
      <AuthProvider>
        <LoginModalProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <ExpandableScreen layoutId="login-button" triggerRadius="12px" contentRadius="24px" animationDuration={0.3}>
              <LoginExpandController />
              {loading ? (
                <Preloader />
              ) : (
                <AuthRedirectHandler>
                  <Layout currentProject={currentProject} onProjectChange={onProjectChange}>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="features" element={<Navigate to="/" replace />} />
                      <Route path="about" element={<About />} />
                      <Route path="demo" element={<Demo />} />
                      <Route path="demonstration" element={<Demonstration currentProject={currentProject} onProjectChange={onProjectChange} setCurrentProject={setCurrentProject}/>} />
                      <Route path="auth" element={<Auth />} />
                      <Route path="profile" element={<Profile />} />
                      <Route path="terms" element={<TermsOfService />} />
                      <Route path="privacy" element={<PrivacyPolicy />} />
                      <Route path="cookies" element={<CookiePolicy />} />
                      <Route path="contact" element={<Contact />} />
                      <Route path="access-denied" element={<AccessDenied />} />
                      <Route path="onboarding" element={<Onboarding />} />
                    </Routes>
                  </Layout>
                </AuthRedirectHandler>
              )}
              <ExpandableScreenContent
                className="bg-[#fcfbf8]"
                showCloseButton={false}
              >
                <Auth />
              </ExpandableScreenContent>
            </ExpandableScreen>
          </Router>
        </LoginModalProvider>
      </AuthProvider>
    </ExtensionProvider>
  );
}

export default App; 