import { Link, useLocation } from 'react-router-dom';
import { auth } from '../firebase-init';
import { useExtension } from "../context/ExtensionContext";
import { useAuth } from "../context/AuthContext";
import { useLoginModal } from "../context/LoginModalContext";
import { getImagePath } from '../utils/assetPaths';

// Images moved to public folder - using dynamic paths
const pImage = getImagePath('p.png');
import ProfileDropdown from './ProfileDropdown';

export default function Navbar() {
  const { isInsideExtension } = useExtension();
  const location = useLocation();
  const { open: openLoginModal } = useLoginModal();
  const { 
    isAuthenticated, 
    isWhitelisted, 
    userProfile,
    profileLoading 
  } = useAuth();

  // Only show as logged in if authenticated AND whitelisted
  const isLoggedIn = isAuthenticated && isWhitelisted;
  const isHomePage = location.pathname === '/';

  const handleLogout = async () => {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("companyEmail");
    localStorage.removeItem("currentProject");
    localStorage.removeItem("sharedCompanyEmail");
    localStorage.removeItem("sharedProjectId");
    console.log("Removed companyEmail and project context");

    try {
      // Dispatch a custom event to clear chats in Demonstration.jsx
      const clearChatsEvent = new CustomEvent('clearChats');
      window.dispatchEvent(clearChatsEvent);

      // Sign out from Firebase
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (isInsideExtension)
    return null;

  return (
    <nav
      className="navbar"
      style={{
        backgroundColor: 'white',
        transition: 'background-color 0.3s ease',
        fontFamily: 'Times New Roman, Times, serif'
      }}
    >
      <div className="nav-container">
        <div className="nav-left"
          style={{ marginLeft: '295px' }}
        >
          <Link to="/" className="logo">
            <img src={pImage} alt="Phraze Logo" className="logo-img" />
          </Link>
        </div>
        <div className="nav-center">
          <Link to="/" className="nav-link" style={{ fontSize: '18px' }}>Home</Link>
          <Link to="/features" className="nav-link" style={{ fontSize: '18px' }}>Features</Link>
          <Link to="/about" className="nav-link" style={{ fontSize: '18px' }}>About</Link>
          <Link to="/contact" className="nav-link" style={{ fontSize: '18px' }}>Contact</Link>
        </div>
        <div className="nav-right" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginRight: '295px'
        }}>
          {/* <a href="https://chrome.google.com/webstore/detail/your-extension-id" className="add-to-chrome">
            <i className="fab fa-chrome"></i>
            Add to Chrome
          </a> */}
          {!isLoggedIn ? (
            isHomePage ? (
              <button
                onClick={() => openLoginModal('login-button')}
                id="login-button"
                className="login-button"
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'rgb(235, 235, 235)',
                  color: 'black',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                  display: 'inline-block',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Times New Roman, Times, serif'
                }}
              >
                Login
              </button>
            ) : (
              <Link to="/auth" id="login-button" className="login-button" style={{
                padding: '8px 16px',
                backgroundColor: 'rgb(235, 235, 235)',
                color: 'black',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                display: 'inline-block'
              }}>
                Login
              </Link>
            )
          ) : (
            <div style={{ position: 'relative' }}>
              <ProfileDropdown
                profileImage={userProfile.profileImage}
                userEmail={userProfile.email}
                username={userProfile.username}
                firstName={userProfile.firstName}
                lastName={userProfile.lastName}
                onLogout={handleLogout}
              />
            </div>
          )}
        </div>
      </div>
    </nav>
  );
} 