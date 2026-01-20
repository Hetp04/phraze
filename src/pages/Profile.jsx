import React, { useState,useEffect } from 'react';
import { auth } from '../firebase-init';
import { getFirebaseData } from '../funcs';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { userProfile, isAuthenticated } = useAuth();
  
  // Use context data
  const username = userProfile.username || '';
  const email = userProfile.email || '';
  const profileImage = userProfile.profileImage || null;
  const isLoggedIn = isAuthenticated;
  const companyEmail = userProfile.companyEmail || null;
  
  const [activeTab, setActiveTab] = useState('profile');
  const [showUsernameEdit, setShowUsernameEdit] = useState(false);
  const [showPasswordEdit, setShowPasswordEdit] = useState(false);

  // Placeholder handlers
  const handleTabClick = (tab) => setActiveTab(tab);
  const handleUsernameEdit = () => setShowUsernameEdit(true);
  const handlePasswordEdit = () => setShowPasswordEdit(true);
  const handleCancelUsername = () => setShowUsernameEdit(false);
  const handleCancelPassword = () => setShowPasswordEdit(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setIsLoggedIn(!!user);

      if (user) {
        const email = user.email.replace('.', ',');
        const companyEmailPath = await getFirebaseData(`emailToCompanyDirectory/${email}`);
        setCompanyEmail(companyEmailPath);
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // All data now comes from AuthContext

  return (
    <div style={{ width: '100%', background: 'rgb(245,245,245)' }}>
      <section id="profile-sub-frame" className="sub-frame" style={{ maxWidth: 600, margin: '0 auto', padding: 24, paddingTop: '100px', paddingBottom: '100px' }}>
        {/* Profile Settings View */}
        {(
          <div id="flag-profile">
            <div className="container">
              <div className="profile-header" style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <div className="profile-picture">
                  <div className="profile-picture-placeholder" id="profile-image-container" style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img id="profile-image" src={profileImage} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  </div>
                  <input type="file" id="profile-picture-input" accept="image/*" style={{ display: 'none' }} />
                  <label htmlFor="profile-picture-input" className="camera-button" style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                      <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                  </label>
                </div>
                <div className="header-text">
                  <h1>Account Settings</h1>
                  <p>Manage your account preferences and settings</p>
                  <div className="header-user-info">
                    <p>Username: <span className="username-value">{username}</span></p>
                    <p>Email: <span className="email-value">{email}</span></p>
                  </div>
                </div>
              </div>

              <div className="tabs" style={{ display: 'flex', gap: 2, background: '#f1f5f9', padding: 4, borderRadius: 8, marginBottom: 24, marginTop: 24 }}>
                <button className={`tab${activeTab === 'profile' ? ' active' : ''}`} onClick={() => handleTabClick('profile')} style={{ padding: '8px 16px', flex: 1, textAlign: 'center', cursor: 'pointer', border: 'none', background: activeTab === 'profile' ? 'white' : 'none', borderRadius: 6, fontSize: 14, color: activeTab === 'profile' ? '#222' : '#888', fontWeight: 500 }}>Profile</button>
                <button className={`tab${activeTab === 'notifications' ? ' active' : ''}`} onClick={() => handleTabClick('notifications')} style={{ padding: '8px 16px', flex: 1, textAlign: 'center', cursor: 'pointer', border: 'none', background: activeTab === 'notifications' ? 'white' : 'none', borderRadius: 6, fontSize: 14, color: activeTab === 'notifications' ? '#222' : '#888', fontWeight: 500 }}>Notifications</button>
              </div>

              {/* Profile Tab Content */}
              {activeTab === 'profile' && (
                <div className="tab-content active" id="profile">
                  <div className="profile-actions" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                    <button className="profile-action-btn" id="change-username" onClick={handleUsernameEdit} style={{ width: '100%', padding: 16, background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s ease', marginBottom: 8 }}>
                      <div className="action-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="action-left" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span role="img" aria-label="user-pen">🖊️</span>
                          <span>Change Username</span>
                        </div>
                        <span role="img" aria-label="pencil">✏️</span>
                      </div>
                    </button>
                    {showUsernameEdit && (
                      <div className="edit-panel" id="username-edit-panel" style={{ marginBottom: 8 }}>
                        <input type="text" placeholder="Enter new username" id="username-input" />
                        <div className="panel-buttons" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button className="cancel-btn" onClick={handleCancelUsername}>Cancel</button>
                          <button className="ok-btn">OK</button>
                        </div>
                      </div>
                    )}
                    <button className="profile-action-btn" id="change-password" onClick={handlePasswordEdit} style={{ width: '100%', padding: 16, background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s ease', marginBottom: 8 }}>
                      <div className="action-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="action-left" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span role="img" aria-label="key">🔑</span>
                          <span>Change Password</span>
                        </div>
                        <span role="img" aria-label="pencil">✏️</span>
                      </div>
                    </button>
                    {showPasswordEdit && (
                      <div className="edit-panel" id="password-edit-panel" style={{ marginBottom: 8 }}>
                        <div className="password-fields">
                          <div className="verification-step">
                            <div className="input-group">
                              <input type="password" placeholder="Current password" id="current-password" />
                            </div>
                            <button id="password-verify-btn" className="verify-btn">Verify</button>
                          </div>
                          <div className="new-password-fields" style={{ display: 'none' }}>
                            <div className="input-group">
                              <input type="password" placeholder="New password" id="new-password" />
                            </div>
                            <div className="input-group">
                              <input type="password" placeholder="Repeat new password" id="repeat-password" />
                            </div>
                          </div>
                        </div>
                        <div className="panel-buttons" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button className="cancel-btn" onClick={handleCancelPassword}>Cancel</button>
                          <button className="ok-btn" style={{ display: 'none' }}>Change Password</button>
                        </div>
                      </div>
                    )}
                    <button className="profile-action-btn" id="profile-logout-btn" style={{ width: '100%', padding: 16, background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s ease', marginBottom: 8 }}>
                      <div className="action-content" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span role="img" aria-label="logout">🚪</span>
                        <span>Logout</span>
                      </div>
                    </button>
                    <button className="profile-action-btn" id="profile-invite-account-btn" style={{ width: '100%', padding: 16, background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s ease' }}>
                      <div className="action-content" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span role="img" aria-label="invite">➕</span>
                        <span>Invite Account</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Notifications Tab Content */}
              {activeTab === 'notifications' && (
                <div className="tab-content" id="notifications">
                  <div className="switch-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                    <div className="switch-text">
                      <h4>Email Notifications</h4>
                      <p>Receive email updates about your account</p>
                    </div>
                    <div className="switch"></div>
                  </div>
                  <div className="switch-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                    <div className="switch-text">
                      <h4>Marketing Updates</h4>
                      <p>Receive news and special offers</p>
                    </div>
                    <div className="switch"></div>
                  </div>
                  <div className="switch-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                    <div className="switch-text">
                      <h4>Account Activity</h4>
                      <p>Get notified about account login activities</p>
                    </div>
                    <div className="switch"></div>
                  </div>
                </div>
              )}

              {/* Footer Links */}
              <div className="profile-footer" style={{ marginTop: 32 }}>
                <div className="profile-footer-links" style={{ display: 'flex', gap: 8, justifyContent: 'center', color: '#888' }}>
                  <a href="#" className="profile-link">Terms</a>
                  <span className="profile-separator">•</span>
                  <a href="#" className="profile-link">Instructions</a>
                  <span className="profile-separator">•</span>
                  <a href="#" className="profile-link">Contact</a>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
} 