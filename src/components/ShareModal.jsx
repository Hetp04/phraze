import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast, generateProjectInviteCode, getFirebaseData, saveFirebaseData, generateUniqueId, getMainCompanyEmail } from '../funcs';
import { auth } from '../firebase-init';
import { DEFAULT_PERMISSIONS } from '../utils/permissionConstants';

// Icon Components
const Icons = {
  Close: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18"/>
      <path d="m6 6 12 12"/>
    </svg>
  ),
  Copy: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Info: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4"/>
      <path d="M12 8h.01"/>
    </svg>
  ),
  Refresh: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M3 21v-5h5"/>
    </svg>
  )
};

export default function ShareModal({ isOpen, onClose, projectId }) {
  const dialogRef = useRef(null);
  const emailInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const searchDebounceTimer = useRef(null);
  const retryCount = useRef(0);
  
  const [inviteCode, setInviteCode] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  
  // Email autocomplete state
  const [allEmailData, setAllEmailData] = useState([]); // Array of {email, name, source}
  const [filteredEmails, setFilteredEmails] = useState([]);
  const [showEmailDropdown, setShowEmailDropdown] = useState(false);
  const [selectedEmailIndex, setSelectedEmailIndex] = useState(-1);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  
  const MIN_SEARCH_CHARS = 2;
  const DEBOUNCE_DELAY_MS = 300;
  const MAX_RETRIES = 3;

  // Load emails from WhitelistedUsers when modal opens
  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setInviteCode(null);
      setIsGenerating(false);
      setEmail('');
      setCopied(false);
      setEmailSent(false);
      setAllEmailData([]);
      setFilteredEmails([]);
      setShowEmailDropdown(false);
      setSelectedEmailIndex(-1);
      return;
    }
    
    const handler = (e) => {
      if (e.key === 'Escape') {
        setShowEmailDropdown(prev => {
          if (prev) {
            return false;
          } else {
            onClose?.();
            return prev;
          }
        });
      }
    };
    window.addEventListener('keydown', handler);
    
    // Load emails from WhitelistedUsers only
    loadAllEmails();

    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [isOpen, onClose]);

  // Auto-generate invite code when modal opens and projectId is available
  useEffect(() => {
    if (isOpen && projectId && !inviteCode && !isGenerating) {
      // Define handleGenerateCode inline to avoid dependency issues
      const generateCode = async () => {
        if (!projectId) return;
        setIsGenerating(true);
        try {
          const code = await generateProjectInviteCode(projectId);
          if (code) {
            setInviteCode(code);
          }
        } catch (err) {
          console.error('Failed to generate invite code:', err);
          showToast('Failed to generate invite code', 'error');
        } finally {
          setIsGenerating(false);
        }
      };
      generateCode();
    }
  }, [isOpen, projectId, inviteCode, isGenerating]);

  // Load emails from WhitelistedUsers only with retry logic (always fetches fresh data)
  const loadAllEmails = async (retryAttempt = 0) => {
    setIsLoadingEmails(true);
    const emailMap = new Map(); // Map email -> {email, name, source}
    
    try {
      // Get current user email to exclude from results
      const currentUser = auth.currentUser;
      const currentUserEmail = currentUser?.email?.toLowerCase() || null;
      
      // Get all emails from WhitelistedUsers only (always fetch fresh from Firebase)
      const whitelistedUsersData = await getFirebaseData('WhitelistedUsers');
      if (whitelistedUsersData && typeof whitelistedUsersData === 'object') {
        Object.keys(whitelistedUsersData).forEach(emailPath => {
          const email = emailPath.replace(/,/g, '.');
          const lowerEmail = email.toLowerCase();
          // Exclude current user's email from results
          if (lowerEmail !== currentUserEmail && !emailMap.has(lowerEmail)) {
            emailMap.set(lowerEmail, { email, name: null, source: 'whitelist' });
          }
        });
      }
      
      // Convert Map to array
      const emailData = Array.from(emailMap.values());
      
      setAllEmailData(emailData);
      
      retryCount.current = 0; // Reset retry count on success
      
    } catch (error) {
      console.error('Error loading emails (attempt', retryAttempt + 1, '):', error);
      
      // Retry with exponential backoff
      if (retryAttempt < MAX_RETRIES) {
        const delay = Math.pow(2, retryAttempt) * 1000; // 1s, 2s, 4s
        console.log('Retrying in', delay, 'ms...');
        setTimeout(() => loadAllEmails(retryAttempt + 1), delay);
      } else {
        console.error('Max retries reached. Email autocomplete disabled.');
        showToast('Failed to load email list for autocomplete', 'error');
      }
    } finally {
      setIsLoadingEmails(false);
    }
  };

  // Calculate Levenshtein distance for fuzzy matching
  const levenshteinDistance = (str1, str2) => {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(0));
    
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] = Math.min(
            matrix[j - 1][i - 1] + 1, // substitution
            matrix[j][i - 1] + 1,     // insertion
            matrix[j - 1][i] + 1      // deletion
          );
        }
      }
    }
    return matrix[len2][len1];
  };

  // Filter and rank emails with debouncing
  useEffect(() => {
    // Clear previous debounce timer
    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
    }

    // Require minimum characters
    if (!email.trim() || email.trim().length < MIN_SEARCH_CHARS) {
      setFilteredEmails([]);
      setShowEmailDropdown(false);
      setSelectedEmailIndex(-1);
      return;
    }

    // Debounce search
    searchDebounceTimer.current = setTimeout(() => {
      const searchTerm = email.trim().toLowerCase();
      
      // Get current user email to exclude from results
      const currentUser = auth.currentUser;
      const currentUserEmail = currentUser?.email?.toLowerCase() || null;
      
      // Check if search term is a complete valid email address
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isCompleteEmail = emailRegex.test(searchTerm);
      
      // Filter and rank results
      let exactEmailMatch = false;
      const matches = allEmailData
        .filter(userData => {
          // Always exclude current user
          const emailLower = userData.email.toLowerCase();
          if (emailLower === currentUserEmail) {
            return false;
          }
          // Check for exact email match
          if (emailLower === searchTerm) {
            exactEmailMatch = true;
            // Don't include exact matches in dropdown (user has typed complete email)
            return false;
          }
          return true;
        })
        .map(userData => {
          const emailLower = userData.email.toLowerCase();
          const nameLower = (userData.name || '').toLowerCase();
          
          // Check for matches in email or name
          const emailMatch = emailLower.includes(searchTerm);
          const nameMatch = nameLower.includes(searchTerm);
          
          if (!emailMatch && !nameMatch) {
            // Try fuzzy matching (max distance of 2)
            const emailDistance = levenshteinDistance(searchTerm, emailLower.substring(0, searchTerm.length));
            const nameDistance = userData.name ? levenshteinDistance(searchTerm, nameLower.substring(0, searchTerm.length)) : Infinity;
            
            if (emailDistance <= 2 || nameDistance <= 2) {
              return { ...userData, score: 100 + Math.min(emailDistance, nameDistance) }; // Fuzzy match (low priority)
            }
            return null; // No match
          }
          
          // Calculate relevance score (lower = better)
          let score = 0;
          
          if (emailLower.startsWith(searchTerm)) {
            score = 10; // Starts with (high priority)
          } else if (emailMatch) {
            score = 20; // Contains (medium priority)
          } else if (nameLower === searchTerm) {
            score = 5; // Exact name match
          } else if (nameLower.startsWith(searchTerm)) {
            score = 15; // Name starts with
          } else if (nameMatch) {
            score = 25; // Name contains
          }
          
          return { ...userData, score };
        })
        .filter(item => item !== null)
        .sort((a, b) => a.score - b.score); // Sort by relevance
      
      // Hide dropdown if no matches or if exact email match found (complete valid email typed)
      const shouldShowDropdown = matches.length > 0 && !(isCompleteEmail && exactEmailMatch);
      
      setFilteredEmails(matches);
      setShowEmailDropdown(shouldShowDropdown);
      setSelectedEmailIndex(-1);
    }, DEBOUNCE_DELAY_MS);

    return () => {
      if (searchDebounceTimer.current) {
        clearTimeout(searchDebounceTimer.current);
      }
    };
  }, [email, allEmailData]);

  // Handle keyboard navigation in email dropdown
  const handleEmailInputKeyDown = (e) => {
    if (!showEmailDropdown || filteredEmails.length === 0) {
      if (e.key === 'Enter') {
        handleSendEmail();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedEmailIndex(prev => 
          prev < filteredEmails.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedEmailIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedEmailIndex >= 0 && selectedEmailIndex < filteredEmails.length) {
          selectEmail(filteredEmails[selectedEmailIndex]);
        } else if (filteredEmails.length === 1) {
          // Auto-select if only one match
          selectEmail(filteredEmails[0]);
        } else {
          handleSendEmail();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowEmailDropdown(false);
        setSelectedEmailIndex(-1);
        break;
    }
  };

  // Select an email from dropdown
  const selectEmail = (userData) => {
    setEmail(userData.email);
    setShowEmailDropdown(false);
    setSelectedEmailIndex(-1);
    emailInputRef.current?.focus();
  };

  // Highlight matched characters in text
  const highlightMatch = (text, searchTerm) => {
    if (!text || !searchTerm) return text;
    
    const index = text.toLowerCase().indexOf(searchTerm.toLowerCase());
    if (index === -1) return text;
    
    return (
      <>
        {text.substring(0, index)}
        <span style={{ backgroundColor: '#fef3c7', fontWeight: 600 }}>
          {text.substring(index, index + searchTerm.length)}
        </span>
        {text.substring(index + searchTerm.length)}
      </>
    );
  };

  const handleGenerateCode = async () => {
    if (!projectId) {
      showToast('No project selected', 'error');
      return;
    }
    
    setIsGenerating(true);
    try {
      const code = await generateProjectInviteCode(projectId);
      if (code) {
        setInviteCode(code);
      }
    } catch (err) {
      console.error('Failed to generate invite code:', err);
      showToast('Failed to generate invite code', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback to legacy copy
      const textarea = document.createElement('textarea');
      textarea.value = inviteCode;
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        showToast('Failed to copy. Please copy manually.', 'error');
      }
      document.body.removeChild(textarea);
    }
  };

  const handleRegenerateCode = async () => {
    if (!projectId) {
      showToast('No project selected', 'error');
      return;
    }
    
    setIsGenerating(true);
    setCopied(false); // Reset copy state
    try {
      const code = await generateProjectInviteCode(projectId);
      if (code) {
        setInviteCode(code);
        showToast('New invite code generated', 'success');
      }
    } catch (err) {
      console.error('Failed to regenerate invite code:', err);
      showToast('Failed to regenerate invite code', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendEmail = async () => {
    // Step 1: Validate email format
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      showToast('Please enter an email address', 'error');
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    // Check if projectId and required data are available
    if (!projectId) {
      showToast('No project selected', 'error');
      return;
    }

    // Get current user
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      showToast('You must be logged in to send invitations', 'error');
      return;
    }

    const currentUserEmail = currentUser.email.toLowerCase();

    // Prevent self-invite
    if (trimmedEmail === currentUserEmail) {
      showToast('You cannot invite yourself', 'error');
      return;
    }

    // SECURITY: Get owner company email by verifying project membership
    // This ensures we use the correct company and prevents localStorage manipulation attacks
    let ownerCompanyEmail = null;
    
    try {
      // First, try to get from shared project context (if viewing a shared project)
      const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
      const sharedProjectId = localStorage.getItem('sharedProjectId');
      const currentProject = localStorage.getItem('currentProject');
      
      if (sharedCompanyEmail && sharedProjectId && currentProject && sharedProjectId === projectId) {
        // SECURITY: Verify the user is actually a member of this project under this company
        const userEmailPath = currentUserEmail.replace(/\./g, ',');
        const companyEmailPath = sharedCompanyEmail.replace(/\./g, ',');
        const memberData = await getFirebaseData(
          `Companies/${companyEmailPath}/projects/${projectId}/members/${userEmailPath}`
        );
        
        if (memberData) {
          // User is a member - verify they have share permission
          const hasSharePermission = memberData.permissions?.share === true || 
                                     memberData.role === 'owner' ||
                                     !memberData.permissions; // Default permissions include share
          
          if (hasSharePermission) {
            ownerCompanyEmail = sharedCompanyEmail;
          } else {
            showToast('You do not have permission to share this project', 'error');
            return;
          }
        } else {
          // SECURITY: Not a member of the shared project - this shouldn't happen if localStorage is valid
          // But for security, we reject the operation rather than silently falling back
          showToast('You are not a member of this project', 'error');
          return;
        }
      } else {
        // Not viewing a shared project - use user's own company
      ownerCompanyEmail = await getMainCompanyEmail();
      }
      
      if (!ownerCompanyEmail) {
        showToast('Failed to get company information', 'error');
        return;
      }
      
      // SECURITY: Project existence is already verified by membership check above
      // If we successfully read memberData, the project must exist
      // No need for redundant check that might fail due to Firebase rules
      const ownerCompanyEmailPath = ownerCompanyEmail.replace(/\./g, ',');
      
      // SECURITY: For own projects, verify user owns the company or is a member with share permission
      if (!sharedCompanyEmail || sharedProjectId !== projectId) {
        // This is the user's own project - verify ownership or membership
        const userEmailPath = currentUserEmail.replace(/\./g, ',');
        const userCompanyEmail = await getFirebaseData(`emailToCompanyDirectory/${userEmailPath}`);
        const userCompanyEmailPath = userCompanyEmail ? userCompanyEmail.replace(/\./g, ',') : null;
        const isOwner = userCompanyEmailPath === ownerCompanyEmailPath;
        
        if (!isOwner) {
          // Not the owner - check if they're a member with share permission
          const memberData = await getFirebaseData(
            `Companies/${ownerCompanyEmailPath}/projects/${projectId}/members/${userEmailPath}`
          );
          
          if (!memberData) {
            showToast('You do not have access to this project', 'error');
            return;
          }
          
          const hasSharePermission = memberData.permissions?.share === true || 
                                   memberData.role === 'owner' ||
                                   !memberData.permissions;
          
          if (!hasSharePermission) {
            showToast('You do not have permission to share this project', 'error');
            return;
          }
        }
      }
      
    } catch (error) {
      console.error('Error getting company email:', error);
      showToast('Failed to get company information', 'error');
      return;
    }

    // Format emails for Firebase paths (replace dots with commas)
    const invitedEmailPath = trimmedEmail.replace(/\./g, ',');
    const ownerCompanyEmailPath = ownerCompanyEmail.replace(/\./g, ',');

    setIsSendingInvite(true);

    try {
      // Step 2: Check if user exists in Firebase (emailToCompanyDirectory or WhitelistedUsers)
      const userCompanyEmail = await getFirebaseData(`emailToCompanyDirectory/${invitedEmailPath}`);
      const isWhitelisted = await getFirebaseData(`WhitelistedUsers/${invitedEmailPath}`);

      if (userCompanyEmail || isWhitelisted) {
        // Step 2A: User exists (in emailToCompanyDirectory) or is whitelisted - Add to project immediately
        // Check if user is already a member
        const existingMember = await getFirebaseData(
          `Companies/${ownerCompanyEmailPath}/projects/${projectId}/members/${invitedEmailPath}`
        );

        if (existingMember) {
          showToast('This user is already a member of this project', 'error');
          setIsSendingInvite(false);
          return;
        }

        // SECURITY: Use try-catch to handle partial failures and ensure data consistency
        let memberAdded = false;
        let reverseMappingAdded = false;
        
        try {
        // Add user to project members
        const memberData = {
          role: 'editor',
          joinedAt: new Date().toISOString(),
          email: trimmedEmail,
          permissions: DEFAULT_PERMISSIONS,
          invitedBy: currentUserEmail,
          invitedVia: 'email'
        };

        await saveFirebaseData(
          `Companies/${ownerCompanyEmailPath}/projects/${projectId}/members/${invitedEmailPath}`,
          memberData
        );
          memberAdded = true;

        // Create reverse mapping in emailToSharedProjects
        // Firebase rules now allow project owners to write to invitees' paths
        const sharedProjectData = {
          projectId: projectId,
          ownerCompany: ownerCompanyEmailPath,
          joinedAt: new Date().toISOString(),
          invitedBy: currentUserEmail
        };

        await saveFirebaseData(
          `emailToSharedProjects/${invitedEmailPath}/${ownerCompanyEmailPath}/${projectId}`,
          sharedProjectData
        );
          reverseMappingAdded = true;
          
        } catch (memberError) {
          // SECURITY: Cleanup on partial failure
          // If member addition succeeded but reverse mapping failed, try to clean up
          console.error('Error adding member or reverse mapping:', memberError);
          
          if (memberAdded && !reverseMappingAdded) {
            // Member was added but reverse mapping failed - try to remove member
            try {
              const { deleteFirebaseData } = await import('../funcs');
              await deleteFirebaseData(
                `Companies/${ownerCompanyEmailPath}/projects/${projectId}/members/${invitedEmailPath}`
              );
              console.log('Cleaned up partially added member due to reverse mapping failure');
            } catch (cleanupError) {
              console.error('Failed to cleanup member after reverse mapping failure:', cleanupError);
              // Log for manual cleanup - this is a rare edge case
            }
          }
          
          // Re-throw to show error to user
          throw memberError;
        }

        // Note: The ChatSidebar listener will detect the new shared project and auto-switch
        // The user will be automatically redirected to the shared project if they're logged in
        
        showToast(`Successfully invited ${trimmedEmail} to the project`, 'success');
        setEmail('');
        setEmailSent(true);
        setTimeout(() => {
          setEmailSent(false);
        }, 2000);
      } else {
        // Step 2B: User doesn't exist - Store pending invitation
        const inviteToken = generateUniqueId(20);
        const pendingInviteData = {
          email: trimmedEmail,
          projectId: projectId,
          ownerCompany: ownerCompanyEmailPath,
          invitedBy: currentUserEmail,
          invitedAt: new Date().toISOString(),
          status: 'pending'
        };

        // Store pending invite under the email path
        await saveFirebaseData(
          `pendingInvites/${invitedEmailPath}/${inviteToken}`,
          pendingInviteData
        );

        // Redirect to signup page with email and inviteToken as query parameters
        const signupUrl = `/#/auth?email=${encodeURIComponent(trimmedEmail)}&inviteToken=${inviteToken}`;
        
        showToast('This user needs to sign up first. Redirecting to sign up page...', 'info');
        
        // Close modal and navigate after a short delay to allow toast to be seen
        setTimeout(() => {
          onClose?.();
          window.location.href = signupUrl;
        }, 1500);
      }
    } catch (error) {
      console.error('Error sending email invite:', error);
      showToast(error.message || 'Failed to send invitation. Please try again.', 'error');
    } finally {
      setIsSendingInvite(false);
    }
  };

  if (!isOpen) return null;

  const projectName = projectId === 'default' ? 'Default Project' : projectId;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500&display=swap');

        .share-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: rgba(0,0,0,0.15);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000003;
          animation: fadeIn 0.25s ease-out;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        .share-modal-card {
          background: #ffffff;
          width: 100%;
          max-width: 560px;
          border-radius: 20px;
          box-shadow: 
            0 4px 6px -1px rgba(0, 0, 0, 0.05),
            0 10px 15px -3px rgba(0, 0, 0, 0.05),
            0 0 0 1px rgba(0,0,0,0.05);
          overflow: hidden;
          animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          transform: translateZ(0); /* Force hardware acceleration to prevent layout shifts */
          will-change: transform;
          margin: auto; /* Center vertically without flex alignment issues */
        }

        .share-modal-header {
          padding: 24px 24px 0 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .share-modal-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: #171717;
          margin: 0;
          letter-spacing: -0.01em;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .share-modal-project-name {
          color: #171717;
          font-weight: 600;
        }

        .share-modal-close-btn {
          background: transparent;
          border: none;
          color: #a3a3a3;
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          display: flex;
          transition: all 0.2s;
        }

        .share-modal-close-btn:hover {
          background-color: #f5f5f5;
          color: #171717;
        }

        .share-modal-body {
          padding: 20px 24px 28px 24px;
        }

        .share-modal-description {
          font-size: 0.9375rem;
          color: #737373;
          margin-top: 0;
          margin-bottom: 24px;
          line-height: 1.5;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .share-modal-field-group {
          margin-bottom: 0;
        }

        .share-modal-label {
          display: block;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #171717;
          margin-bottom: 8px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .share-modal-control-wrapper {
          display: flex;
          align-items: center;
          background-color: #ffffff;
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          padding: 4px;
          transition: all 0.2s ease;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
          min-height: 48px; /* Reserve space to prevent layout shift */
        }

        .share-modal-control-wrapper:focus-within {
          border-color: #171717;
          box-shadow: none;
        }

        .share-modal-text-input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          padding: 0 12px;
          font-size: 0.9375rem;
          color: #171717;
          height: 40px;
          min-width: 0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 40px; /* Ensure consistent line height */
        }

        .share-modal-code-font {
          font-family: 'JetBrains Mono', monospace;
          font-weight: 500;
          font-size: 1rem;
          letter-spacing: 0.5px;
        }

        .share-modal-text-input::placeholder {
          color: #a3a3a3;
        }

        .share-modal-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 40px;
          padding: 0 16px;
          border-radius: 8px;
          border: none;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .share-modal-action-btn.secondary {
          background-color: #f5f5f5;
          color: #171717;
        }

        .share-modal-action-btn.secondary:hover {
          background-color: #e5e5e5;
        }

        .share-modal-action-btn.primary {
          background-color: #171717;
          color: white;
        }

        .share-modal-action-btn.primary:hover:not(:disabled) {
          background-color: #000000;
          transform: translateY(-1px);
        }

        .share-modal-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .share-modal-action-btn.success {
          background-color: #f0fdf4;
          color: #15803d;
        }

        .share-modal-divider {
          height: 1px;
          background-color: #e5e5e5;
          margin: 24px 0;
          width: 100%;
        }

        .share-modal-info-box {
          margin-top: 24px;
          background-color: #fafafa;
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .share-modal-info-icon {
          color: #737373;
          flex-shrink: 0;
          margin-top: 3px;
        }

        .share-modal-info-content {
          font-size: 0.8125rem;
          line-height: 1.6;
          color: #525252;
        }

        .share-modal-email-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          background: #ffffff;
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          max-height: 300px;
          overflow-y: auto;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          z-index: 1000004;
        }

        .share-modal-email-item {
          padding: 12px 16px;
          cursor: pointer;
          font-size: 0.9375rem;
          color: #171717;
          border-bottom: 1px solid #f5f5f5;
          transition: background-color 0.15s;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.4;
        }

        .share-modal-email-item:last-child {
          border-bottom: none;
        }

        .share-modal-email-item:hover,
        .share-modal-email-item.selected {
          background-color: #f5f5f5;
        }

        .share-modal-info-content strong {
          color: #171717;
          font-weight: 600;
          margin-right: 4px;
        }

        .share-modal-info-content p {
          margin: 0;
        }

        .share-modal-regenerate-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: #737373;
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          padding: 8px 0;
          margin-top: 8px;
          transition: color 0.2s;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .share-modal-regenerate-btn:hover {
          color: #171717;
        }

        .share-modal-regenerate-btn:active {
          opacity: 0.7;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @media (max-width: 500px) {
          .share-modal-card {
            margin: 10px;
            border-radius: 16px;
          }
          .share-modal-header {
            padding-bottom: 0;
          }
        }
      `}</style>

      <div
        role="presentation"
        className="share-modal-overlay"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="share-modal-card"
          onClick={(e) => e.stopPropagation()}
          ref={dialogRef}
        >
          {/* Header */}
          <div className="share-modal-header">
            <h2 className="share-modal-title">
              Share Project: <span className="share-modal-project-name">{projectName}</span>
            </h2>
            <button 
              className="share-modal-close-btn" 
              aria-label="Close"
              onClick={onClose}
            >
              <Icons.Close />
            </button>
          </div>

          <div className="share-modal-body">
            <p className="share-modal-description">
              Invite your team to collaborate. Secure access is granted instantly via invite code.
            </p>

            {/* Section: Invite Code */}
            <div className="share-modal-field-group">
              <label className="share-modal-label">Invite Code</label>
              <div className="share-modal-control-wrapper">
                {isGenerating ? (
                  <>
                    <input 
                      type="text" 
                      readOnly 
                      value="Generating..." 
                      className="share-modal-text-input share-modal-code-font"
                      disabled
                    />
                    <div style={{ width: '80px', height: '40px' }}></div>
                  </>
                ) : inviteCode ? (
                  <>
                    <input 
                      type="text" 
                      readOnly 
                      value={inviteCode} 
                      className="share-modal-text-input share-modal-code-font"
                    />
                    <button 
                      className={`share-modal-action-btn ${copied ? 'success' : 'secondary'}`} 
                      onClick={handleCopyCode}
                    >
                      {copied ? <Icons.Check /> : <Icons.Copy />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <input 
                      type="text" 
                      readOnly 
                      value="Click to generate" 
                      className="share-modal-text-input"
                      disabled
                    />
                    <button 
                      className="share-modal-action-btn primary" 
                      onClick={handleGenerateCode}
                    >
                      <span>Generate</span>
                    </button>
                  </>
                )}
              </div>
              {/* Regenerate button - show when code is generated */}
              {inviteCode && !isGenerating && (
                <button
                  onClick={handleRegenerateCode}
                  className="share-modal-regenerate-btn"
                  type="button"
                >
                  <Icons.Refresh />
                  <span>Regenerate code</span>
                </button>
              )}
            </div>

            <div className="share-modal-divider"></div>

            {/* Section: Email Invite */}
            <div className="share-modal-field-group" style={{ position: 'relative' }}>
              <label className="share-modal-label">Share via email</label>
              <div className="share-modal-control-wrapper" style={{ position: 'relative', marginBottom: showEmailDropdown && filteredEmails.length > 0 ? '4px' : '0' }}>
                <input 
                  ref={emailInputRef}
                  type="email" 
                  placeholder="colleague@company.com" 
                  className="share-modal-text-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleEmailInputKeyDown}
                  onFocus={() => {
                    if (filteredEmails.length > 0) {
                      setShowEmailDropdown(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay closing to allow click on dropdown item
                    setTimeout(() => setShowEmailDropdown(false), 200);
                  }}
                  autoComplete="off"
                />
                <button 
                  className={`share-modal-action-btn ${emailSent ? 'success' : 'primary'}`} 
                  onClick={handleSendEmail}
                  disabled={emailSent || !email.trim() || isSendingInvite}
                >
                  {emailSent ? (
                    <>
                      <Icons.Check />
                      <span>Sent</span>
                    </>
                  ) : isSendingInvite ? (
                    <span>Sending...</span>
                  ) : (
                    <span>Invite</span>
                  )}
                </button>
              </div>
              
              {/* Email Autocomplete Dropdown */}
              {showEmailDropdown && filteredEmails.length > 0 && (
                <div className="share-modal-email-dropdown">
                  {filteredEmails.map((userData, index) => (
                    <div
                      key={userData.email}
                      className={`share-modal-email-item ${
                        index === selectedEmailIndex ? 'selected' : ''
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent input blur
                        selectEmail(userData);
                      }}
                      onMouseEnter={() => setSelectedEmailIndex(index)}
                    >
                      {highlightMatch(userData.email, email.trim())}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="share-modal-info-box">
              <div className="share-modal-info-icon">
                <Icons.Info />
              </div>
              <div className="share-modal-info-content">
                <p>
                  <strong>How it works:</strong> Share the invite code with your team. They can enter it in the "Shared Projects" tab to join this project and collaborate.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
