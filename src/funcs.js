// Import necessary Firebase functions
import { database, auth } from './firebase-init';
import { ref, get, set, remove, serverTimestamp, push, runTransaction } from 'firebase/database';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { DEFAULT_PERMISSIONS } from './utils/permissionConstants';


// Add global username variable
export let currentUsername = "Guest";
export let currentCompanyEmail = "";
export let isLoggedIn = false;

// Function to generate a unique ID for shared chats
export function generateUniqueId(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomValues = new Uint8Array(length);
    window.crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
        result += chars[randomValues[i] % chars.length];
    }
    return result;
}

// Function to initialize and listen for username changes
export function initUsernameFetcher() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            isLoggedIn = true;
            try {
                // Get company email for the user
                const userEmail = user.email.replace(/\./g, ',');
                let companyEmail = await getFirebaseData(`emailToCompanyDirectory/${userEmail}`);

                if (companyEmail) {
                    // Ensure company email has all periods replaced with commas for Firebase paths
                    currentCompanyEmail = companyEmail.replace(/\./g, ',');
                    
                    // Save company email to localStorage (convert commas back to periods for display)
                    const displayCompanyEmail = companyEmail.replace(/,/g, '.');
                    localStorage.setItem('companyEmail', currentCompanyEmail);
                    console.log('Saved company email to localStorage:', displayCompanyEmail);
                    
                    // Fetch username from the company directory
                    const userData = await getFirebaseData(`Companies/${currentCompanyEmail}/users/${userEmail}`);
                    if (userData && userData.name) {
                        currentUsername = userData.name;
                    } else {
                        currentUsername = user.email.split('@')[0]; // Fallback to email prefix
                    }
                } else {
                    currentUsername = user.email.split('@')[0]; // Fallback to email prefix
                    console.log('No company email found for user:', user.email);
                }
            } catch (error) {
                console.error("Error fetching username:", error);
                currentUsername = "User";
            }
        } else {
            currentUsername = "Guest";
            currentCompanyEmail = "";
            isLoggedIn = false;
            // Clear company email from localStorage on logout
            localStorage.removeItem('companyEmail');
            console.log('Cleared company email from localStorage on logout');
        }
    });
}

export async function getFirebaseData(path) {
    // Create a reference to the specified path in the database
    const dbRef = ref(database, path);

    // Return a promise that resolves with the data at the specified path
    return get(dbRef)
        .then((snapshot) => {
            if (snapshot.exists()) {
                return snapshot.val();
            } else {
                // Removed excessive console.log for performance
                return null;
            }
        })
        .catch((error) => {
            const msg = (error && (error.code || error.message || String(error))) || 'Unknown error';
            // Downgrade noise for expected access misses (e.g., optional defaults or member-only paths)
            if (String(msg).toLowerCase().includes('permission denied')) {
                console.warn(`Permission denied at path ${path} - returning null`);
                return null;
            }
            console.error(`Error getting data at path ${path}:`, error);
            throw error;
        });
}

// Check if a user is whitelisted
export async function isUserWhitelisted(email) {
    try {
        // Sanitize email: replace "." with ","
        const sanitizedEmail = email.replace(/\./g, ',');
        
        const whitelistPath = `WhitelistedUsers/${sanitizedEmail}`;
        const dbRef = ref(database, whitelistPath);
        
        // Check if the path exists in Firebase
        const snapshot = await get(dbRef);
        console.log('Whitelist snapshot:', snapshot.exists());
        return snapshot.exists();
    } catch (error) {
        console.error('Error checking whitelist:', error);
        // On error, deny access for security
        return false;
    }
}

// Save beta access request to Firebase
export async function saveBetaAccessRequest(email, fullName) {
    try {
        // Parse full name into firstName and lastName
        let firstName = '';
        let lastName = '';
        if (fullName && fullName.trim()) {
            const nameParts = fullName.trim().split(/\s+/);
            firstName = nameParts[0] || '';
            lastName = nameParts.slice(1).join(' ') || '';
        }
        
        const requestID = generateUniqueId(20);
        const userRequestsRef = ref(database, `UserRequests/${requestID}`);
        
        const betaRequestData = {
            firstName: firstName,
            lastName: lastName,
            email: email,
            phone: '', // Phone not collected in form, set to empty string
            timestamp: serverTimestamp(),
            status: 'pending'
        };
        
        await set(userRequestsRef, betaRequestData);
        console.log('Beta access request saved:', requestID);
        
        // Show confirmation message
        showToast("✅ Thank you — your request has been submitted. If approved, you will receive an email with access.", "success", 5000);
    } catch (betaRequestError) {
        console.error('Error saving beta access request:', betaRequestError);
        // Don't fail the sign-up if beta request save fails, just log it
    }
}

export async function saveFirebaseData(path, data) {
    // Create a reference to the specified path in the database
    const dbRef = ref(database, path);

    // Use set() to write data to the specified path
    return new Promise((resolve, reject) => {
        set(dbRef, data)
            .then(() => {
                console.log(`Data successfully saved at path: ${path}`);
                resolve(true);
            })
            .catch((error) => {
                // Suppress permission denied errors for statistics in shared projects (expected behavior)
                const isPermissionError = error?.message?.includes('Permission denied') || 
                                        error?.code === 'PERMISSION_DENIED' ||
                                        error?.message?.includes('PERMISSION_DENIED');
                const isStatisticsPath = path.includes('/statistics');
                const isEmailToCompanyDirectoryPath = path.startsWith('emailToCompanyDirectory/');
                
                if (isPermissionError && (isStatisticsPath || isEmailToCompanyDirectoryPath)) {
                    // Expected: members can't write statistics in shared projects
                    // Silently fail for permission errors on these paths
                    resolve(false);
                    return;
                }
                
                console.error(`Error saving data at path ${path}:`, error);
                reject(error);
            });
    });
}

// Function to delete data from Firebase
export async function deleteFirebaseData(path) {
    // Create a reference to the specified path in the database
    const dbRef = ref(database, path);

    // Use remove() to delete data at the specified path
    return new Promise((resolve) => {
        remove(dbRef)
            .then(() => {
                console.log(`Data successfully deleted at path: ${path}`);
                resolve(true);
            })
            .catch((error) => {
                console.error(`Error deleting data at path ${path}:`, error);
                throw error;
            });
    });
}

// UI State Management Functions (Firebase-based)
function getUIStatePath(userEmail, field) {
    const userEmailPath = userEmail.replace(/\./g, ',');
    return `Users/${userEmailPath}/uiState/${field}`;
}

export async function getUIState(userEmail, field) {
    try {
        const path = getUIStatePath(userEmail, field);
        return await getFirebaseData(path);
    } catch (error) {
        console.error(`Error getting UI state ${field}:`, error);
        return null;
    }
}

export async function setUIState(userEmail, field, value) {
    try {
        const path = getUIStatePath(userEmail, field);
        await saveFirebaseData(path, value);
        return true;
    } catch (error) {
        console.error(`Error setting UI state ${field}:`, error);
        return false;
    }
}

export async function removeUIState(userEmail, field) {
    try {
        const path = getUIStatePath(userEmail, field);
        await deleteFirebaseData(path);
        return true;
    } catch (error) {
        console.error(`Error removing UI state ${field}:`, error);
        return false;
    }
}

/**
 * Process pending email invites for a newly signed up user
 * This function is called after a user completes signup to automatically add them to projects
 * they were invited to before they had an account.
 */
export async function processPendingEmailInvites(userEmail) {
    const emailPath = userEmail.replace(/\./g, ',');
    const pendingInvitesPath = `pendingInvites/${emailPath}`;
    
    try {
        // Get all pending invites for this email
        const pendingInvitesData = await getFirebaseData(pendingInvitesPath);
        
        if (!pendingInvitesData || typeof pendingInvitesData !== 'object') {
            // No pending invites found
            return;
        }

        // Process each pending invite
        const inviteTokens = Object.keys(pendingInvitesData);
        
        for (const inviteToken of inviteTokens) {
            const inviteData = pendingInvitesData[inviteToken];
            
            // Validate invite data
            if (!inviteData || inviteData.status !== 'pending') {
                continue;
            }

            const { projectId, ownerCompany, invitedBy } = inviteData;
            
            if (!projectId || !ownerCompany) {
                console.warn('Invalid invite data, skipping:', inviteToken);
                continue;
            }

            // Check if user is already a member (might have been added via another invite)
            const existingMember = await getFirebaseData(
                `Companies/${ownerCompany}/projects/${projectId}/members/${emailPath}`
            );

            if (existingMember) {
                // Already a member, just delete the pending invite
                await deleteFirebaseData(`${pendingInvitesPath}/${inviteToken}`);
                continue;
            }

            // Add user to project members
            const memberData = {
                role: 'editor',
                joinedAt: new Date().toISOString(),
                email: userEmail,
                permissions: DEFAULT_PERMISSIONS,
                invitedBy: invitedBy || 'email',
                invitedVia: 'email'
            };

            await saveFirebaseData(
                `Companies/${ownerCompany}/projects/${projectId}/members/${emailPath}`,
                memberData
            );

            // Create reverse mapping
            const sharedProjectData = {
                projectId: projectId,
                ownerCompany: ownerCompany,
                joinedAt: new Date().toISOString(),
                invitedBy: invitedBy || 'email'
            };

            await saveFirebaseData(
                `emailToSharedProjects/${emailPath}/${ownerCompany}/${projectId}`,
                sharedProjectData
            );

            // Delete the pending invite after successful processing
            await deleteFirebaseData(`${pendingInvitesPath}/${inviteToken}`);

            // Store the project in Firebase UI state so ChatSidebar can auto-switch to it on first load
            // This helps new users who sign up via email invite get redirected to the shared project
            try {
                const pendingSharedProject = {
                    projectId: projectId,
                    ownerCompany: ownerCompany,
                    joinedAt: new Date().toISOString()
                };
                await setUIState(userEmail, 'pendingSharedProject', pendingSharedProject);
                // Also update localStorage for backward compatibility
                localStorage.setItem('pendingSharedProject', JSON.stringify(pendingSharedProject));
            } catch (e) {
                console.warn('Failed to store pending shared project:', e);
            }

            // Try to get project name for toast message
            try {
                const projectData = await getFirebaseData(`Companies/${ownerCompany}/projects/${projectId}`);
                const projectName = projectData?.name || projectId;
                showToast(`You've been added to project: ${projectName}`, 'success');
            } catch (e) {
                // If we can't get project name, just show generic message
                showToast(`You've been added to project: ${projectId}`, 'success');
            }
        }
    } catch (error) {
        console.error('Error processing pending email invites:', error);
        throw error;
    }
}

export async function finishSignUp(user, username, email, companyEmail, firstName, lastName) {
    if (username)
        await updateProfile(user, {
            displayName: username
        });
    if (!email)
        email = user.email;
    if (!companyEmail)
        companyEmail = user.email;
    if (!username)
        username = email;

    console.log("User account created successfully:", user.uid);
    
    // Save core user data to Firebase (no automatic Google profile photo)
    const userData = {
        createdAt: new Date().toISOString(),
        email: email,
        name: username
    };
    
    // Add firstName and lastName if provided
    if (firstName) {
        userData.firstName = firstName;
    }
    if (lastName) {
        userData.lastName = lastName;
    }
    
    // Only explicitly uploaded avatars will be stored under /profileImage
    saveFirebaseData(`Companies/${companyEmail.replace(".", ",")}/users/${email.replace(".", ",")}`, userData);
    
    // Set up company email directory and localStorage
    const emailPath = email.replace(/\./g, ',');
    const companyEmailPath = companyEmail.replace(/\./g, ',');
    
    // Save to localStorage first (this is critical for the app to work)
    localStorage.setItem('companyEmail', companyEmailPath);
    console.log('Saved company email to localStorage:', companyEmailPath);
    
    // Try to save to Firebase emailToCompanyDirectory (may fail due to permissions)
    try {
        let value = await getFirebaseData(`emailToCompanyDirectory/${emailPath}`);
        if (!value) {
            await saveFirebaseData(`emailToCompanyDirectory/${emailPath}`, companyEmailPath);
            console.log('Saved emailToCompanyDirectory mapping');
        }
    } catch (error) {
        console.warn('Failed to save emailToCompanyDirectory (permission issue):', error);
        // Continue anyway since localStorage is set
    }
    
    // Create default project if it doesn't exist
    try {
        var defaultProject = await getFirebaseData(`Companies/${companyEmailPath}/projects/default`);
        if (!defaultProject) {
            await saveFirebaseData(`Companies/${companyEmailPath}/projects/default`, {
                name: "default",
                created: new Date().toISOString()
            });
            console.log('Created default project');
        }
    } catch (error) {
        console.warn('Failed to create default project:', error);
    }
    
    // Process pending email invites for this user
    try {
        await processPendingEmailInvites(email);
    } catch (error) {
        console.error('Error processing pending email invites:', error);
        // Don't block signup if invite processing fails
    }
    
    // Redirect new users to onboarding
    console.log('New user signed up, redirecting to onboarding');
    window.location.href = '/#/onboarding';
    return user;
}

function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

export async function inviteAccount() {
    let code = generateRandomCode(8);

    saveFirebaseData(`inviteCodes/${code}`,{
        companyEmail: await getMainCompanyEmail(),
        createdAt: new Date().toISOString()});
    //    await navigator.clipboard.writeText(code);
    legacyCopy(code);
}

function generateRandomCode(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}









export async function firebaseCreateAccount(email, password, inviteCode, username, firstName, lastName) {
    // Each user gets their OWN company (their email)
    // Project-level sharing is handled via invite codes AFTER signup
    var companyEmail = email;
    
    // Store invite code to process AFTER user is authenticated
    // We can't validate it before signup because Firebase rules require authentication
    let pendingInviteCode = null;
    if (inviteCode && inviteCode != "") {
        // Trim and uppercase the invite code (project invite codes are stored in uppercase)
        const trimmedCode = inviteCode.trim().toUpperCase();
        // Store for processing after authentication
        pendingInviteCode = trimmedCode;
        console.log("Invite code provided - will be validated and processed after signup");
    }
    
    // Create a new user account with email and password
    return createUserWithEmailAndPassword(auth, email, password)
        .then(async (userCredential) => {

            // User account created successfully - now authenticated
            const user = userCredential.user;
            
            // Save beta access request to Firebase Realtime Database
            await saveBetaAccessRequest(email, username);
            
            // Validate and process invite code NOW that user is authenticated
            if (pendingInviteCode) {
                try {
                    const inviteData = await getFirebaseData(`inviteCodes/${pendingInviteCode}`);
                    
                    if (!inviteData) {
                        // Invalid invite code, but don't block signup since it's optional
                        console.warn("Invalid invite code provided, but continuing with signup");
                        showToast("Invalid invite code - continuing with signup", "warning");
                        pendingInviteCode = null; // Clear it so it's not processed later
                    } else {
                        // Check if this is a project-level invite code
                        if (inviteData.type === 'project') {
                            // Store the code to be processed after account setup
                            console.log("Project invite code validated - will be processed after signup");
                            localStorage.setItem('pendingProjectInviteCode', pendingInviteCode);
                        } else if (inviteData.companyEmail) {
                            // OLD company-level invite code - DEPRECATED
                            console.warn("DEPRECATED: Company-level invite codes are deprecated. Use project sharing instead.");
                            // Delete the old invite code
                            saveFirebaseData(`inviteCodes/${pendingInviteCode}`, null);
                            pendingInviteCode = null; // Clear it
                        } else {
                            // Unknown invite code format
                            console.warn("Unknown invite code format, continuing with signup");
                            showToast("Invalid invite code format - continuing with signup", "warning");
                            pendingInviteCode = null; // Clear it
                        }
                    }
                } catch (error) {
                    // If there's an error fetching the invite code, don't block signup
                    console.error("Error validating invite code:", error);
                    showToast("Error validating invite code - continuing with signup", "warning");
                    pendingInviteCode = null; // Clear it
                }
            }
            
            // Complete signup first to set up user properly
            const result = await finishSignUp(user, username, email, companyEmail, firstName, lastName);
            
            // Process pending project invite code AFTER signup is complete
            // This ensures the user is fully set up before accepting the invite
            const storedInviteCode = localStorage.getItem('pendingProjectInviteCode');
            if (storedInviteCode) {
                console.log('Processing pending project invite code after signup:', storedInviteCode);
                localStorage.removeItem('pendingProjectInviteCode');
                // Process immediately since user is now authenticated and set up
                    try {
                    await acceptProjectInviteCode(storedInviteCode);
                    // acceptProjectInviteCode will handle the reload/redirect
                    } catch (err) {
                        console.error('Failed to accept pending project invite:', err);
                    showToast('Failed to join project. You can join it manually later.', 'warning');
                    }
            }
            
            return result;
        })
        .catch((error) => {
            // Handle errors
            const errorCode = error.code;
            const errorMessage = error.message;
            console.error(`Failed to create account: ${errorCode} - ${errorMessage}`);
            showToast(errorMessage, "error");
            throw error;
        });
}

export function firebaseLogin(email, password) {
    // Sign in a user with email and password
    return signInWithEmailAndPassword(auth, email, password)
        .then(async (userCredential) => {
            // User signed in successfully
            const user = userCredential.user;
            console.log("User signed in successfully:", user.uid);
            
            // Set up company email in localStorage
            try {
                const emailPath = email.replace(/\./g, ',');
                const companyEmail = await getFirebaseData(`emailToCompanyDirectory/${emailPath}`);
                
                if (companyEmail) {
                    localStorage.setItem('companyEmail', companyEmail);
                    console.log('Saved company email to localStorage on login:', companyEmail);
                } else {
                    // If no company email found, use the user's email as company
                    const userEmailAsCompany = emailPath;
                    localStorage.setItem('companyEmail', userEmailAsCompany);
                    console.log('No company email found, using user email as company:', userEmailAsCompany);
                }
            } catch (error) {
                console.warn('Failed to set up company email on login:', error);
                // Fallback: use user's email as company
                const userEmailAsCompany = email.replace(/\./g, ',');
                localStorage.setItem('companyEmail', userEmailAsCompany);
                console.log('Using user email as company fallback:', userEmailAsCompany);
            }
            
            // Check onboarding status and redirect accordingly
            try {
                const emailPath = email.replace(/\./g, ',');
                const companyEmail = await getFirebaseData(`emailToCompanyDirectory/${emailPath}`);
                let onboardingCompleted = false;
                
                if (companyEmail) {
                    const userData = await getFirebaseData(`Companies/${companyEmail}/users/${emailPath}`);
                    onboardingCompleted = userData?.onboardingCompleted || false;
                }
                
                if (onboardingCompleted) {
                    console.log('User has completed onboarding, redirecting to demonstration');
                    window.location.href = '/#/demonstration';
                } else {
                    console.log('User has not completed onboarding, redirecting to onboarding');
                    window.location.href = '/#/onboarding';
                }
            } catch (error) {
                console.warn('Error checking onboarding status, redirecting to onboarding:', error);
                window.location.href = '/#/onboarding';
            }
            
            return user;
        })
        .catch((error) => {
            // Handle errors
            const errorCode = error.code;
            const errorMessage = error.message;
            console.error(`Failed to sign in: ${errorCode} - ${errorMessage}`);
            showToast("Failed to sign in", "error");
            throw error;
        });
}

export function showToast(message, type, durationMs = 3000, iconSvg = null) {
    // Remove any existing GLOBAL toasts (do not remove scoped toasts inside overlays)
    const existingToast = document.querySelector('.toast:not(.toast--scoped)');
    if (existingToast) existingToast.remove();

    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Create toast content container
    const toastContent = document.createElement('div');
    toastContent.style.display = 'flex';
    toastContent.style.alignItems = 'center';
    toastContent.style.gap = '10px';
    
    // Add icon if provided
    if (iconSvg) {
        const iconContainer = document.createElement('div');
        iconContainer.style.display = 'flex';
        iconContainer.style.alignItems = 'center';
        iconContainer.style.flexShrink = '0';
        iconContainer.innerHTML = iconSvg;
        toastContent.appendChild(iconContainer);
    }
    
    // Add message text
    const messageText = document.createElement('span');
    messageText.textContent = message;
    toastContent.appendChild(messageText);
    
    toast.appendChild(toastContent);
    document.body.appendChild(toast);

    // Show toast with animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Hide and remove toast after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            try {
                // Notify listeners that a toast has fully ended
                window.dispatchEvent(new CustomEvent('toast:ended', { detail: { message, type } }));
            } catch (_) {}
            toast.remove();
        }, 300);
    }, durationMs);
}

// Scoped toast that appears within a specific container instead of window bottom
export function showToastScoped(parentElement, message, type, durationMs = 1800) {
    if (!parentElement) {
        // Fallback to global toast if no container provided
        return showToast(message, type);
    }

    // Remove any existing scoped toasts in this container
    const existing = parentElement.querySelector('.toast.toast--scoped');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} toast--scoped`;
    toast.textContent = message;
    parentElement.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            try {
                // Also emit an event for scoped toasts in case consumers care
                window.dispatchEvent(new CustomEvent('toast:ended', { detail: { message, type, scope: 'scoped' } }));
            } catch (_) {}
            toast.remove();
        }, 300);
    }, durationMs);
}


var listenerFuncs = new Map();
export async function firebaseListener(path, id, func) {
    const firebaseDb = await import('firebase/database');
    const { ref, onValue, off } = firebaseDb;
    const { database } = await import('./firebase-init'); // Get database instance
    let listenerRef = ref(database, path);

    let mapKey = path + " " + id;
    if (listenerFuncs.has(mapKey)) {
        off(listenerRef, 'value', listenerFuncs.get(mapKey));
    }
    
    
    // Define the callback for onValue
    const handleValueChange = (snapshot) => {
        func(path, snapshot.val());
    };
    listenerFuncs.set(mapKey, handleValueChange);
    // Attach the listener
    onValue(listenerRef, handleValueChange);
}

export async function getMainCompanyEmail() {
    let user = auth.currentUser;
    if (user) {
        const companyEmail = await getFirebaseData(`emailToCompanyDirectory/${user.email.replace(/\./g, ',')}`);
        // Ensure company email has all periods replaced with commas for Firebase paths
        return companyEmail ? companyEmail.replace(/\./g, ',') : null;
    } else {
        return null;
    }
}

// Get the company email for the current project context
// Returns sharedCompanyEmail if viewing a shared project, otherwise returns user's own company
export function getProjectCompanyEmail() {
    const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
    if (sharedCompanyEmail) {
        // Viewing a shared project - use owner's company email
        return sharedCompanyEmail.replace(/\./g, ',');
    }
    // Viewing own project - use user's company email
    const userCompanyEmail = localStorage.getItem('companyEmail');
    return userCompanyEmail ? userCompanyEmail.replace(/\./g, ',') : null;
}

// Get the full project path for the current context
export function getCurrentProjectPath(projectId) {
    const companyEmail = getProjectCompanyEmail();
    if (!companyEmail) return null;
    return `Companies/${companyEmail}/projects/${projectId}`;
}

export async function updateProfilePicture(func, id) {
    let user = auth.currentUser;
    if (user) {
        let companyEmail = await getMainCompanyEmail();
        firebaseListener(`Companies/${companyEmail}/users/${user.email.replace(".", ",")}/profileImage`, id, function (path, data) {
            func(data);
        });
    }
}



// Deprecated: we no longer auto-use Google photos anywhere.
// Kept as a stub to avoid breaking imports; always returns null.
export async function fetchGoogleProfilePicture() {
            return null;
}

// Handle invite code redemption
export async function handleUseInviteCode(inviteCode, setInviteCode, setIsOpen) {
    console.log('Using invite code:', inviteCode);
    
    if (!inviteCode.trim()) {
        showToast('Please enter an invite code', 'error');
        return;
    }
    
    try {
        showToast('Processing invite code...', 'info');
        
        // Get the new company from the invite code
        const inviteData = await getFirebaseData(`inviteCodes/${inviteCode}`);
        if (!inviteData) {
            showToast('Invalid invite code', 'error');
            return;
        }
        
        // Extract company email string from invite data
        let newCompany;
        if (typeof inviteData === 'string') {
            // Simple string format: "company@example.com"
            newCompany = inviteData;
        } else if (typeof inviteData === 'object' && inviteData.companyEmail) {
            // Object format with companyEmail field: { companyEmail: "company@example.com" }
            newCompany = inviteData.companyEmail;
        } else if (typeof inviteData === 'object' && inviteData.company) {
            // Object format with company field: { company: "company@example.com" }
            newCompany = inviteData.company;
        } else if (typeof inviteData === 'object') {
            // Object without specific field - try common alternatives
            newCompany = inviteData.email || inviteData.companyId;
        }
        
        if (!newCompany || typeof newCompany !== 'string') {
            showToast('Invalid invite code format', 'error');
            console.error('Could not extract company from invite data:', inviteData);
            return;
        }
        
        const oldCompany = localStorage.getItem('companyEmail');
        const userEmail = auth.currentUser?.email;
        
        if (!userEmail) {
            showToast('User not authenticated', 'error');
            return;
        }
        
        // Check if the new company is the same as the old company
 
        if (oldCompany && oldCompany.replace(/\./g, ',') === newCompany.replace(/\./g, ',')) {
            showToast(`This invite code is for the company you're already in. The name of the company you're in is ${oldCompany}`, 'error');
            return;
        }
        
        // Handle case where user doesn't have an existing company (new user)
        if (!oldCompany) {
            console.log('No existing company found, setting up new user');
            // For new users without an existing company, we'll just add them to the new company
            // without migrating data
        }
        
        const userEmailPath = userEmail.replace(/\./g, ',');
        const oldCompanyPath = oldCompany ? oldCompany.replace(/\./g, ',') : null;
        const newCompanyPath = newCompany.replace(/\./g, ',');
        
        if (oldCompany) {
            console.log(`Migrating user ${userEmail} from ${oldCompany} to ${newCompany}`);
        } else {
            console.log(`Setting up new user ${userEmail} in company ${newCompany}`);
        }
        
        // Get current project
        const currentProject = localStorage.getItem('selectedProject') || 'default';
        
        // Only migrate data if user has an existing company
        if (oldCompany && oldCompanyPath) {
            // 1. Copy and migrate all groqChats (make them private in new company)
            // NOTE: Private chats are now stored in a separate secure path
            const oldChatsPath = `Companies/${oldCompanyPath}/projects/${currentProject}/groqChats`;
            const userEmailFormatted = userEmail.replace(/\./g, ',');
            // New path for private chats: privateChats/$userEmail/$chatId (server-enforced security)
            const newPrivateChatsPath = `Companies/${newCompanyPath}/projects/${currentProject}/privateChats/${userEmailFormatted}`;
            const oldChats = await getFirebaseData(oldChatsPath);
            
            if (oldChats) {
                const chatEntries = Object.entries(oldChats);
                for (const [chatId, chatData] of chatEntries) {
                    // Make chat private for this user in the new company (stored in secure path)
                    const privateChatData = {
                        ...chatData,
                        privateUser: userEmail,
                        isPublic: false // Mark as private
                    };
                    await saveFirebaseData(`${newPrivateChatsPath}/${chatId}`, privateChatData);
                }
                console.log(`Copied ${chatEntries.length} chats to new company as private (secure path)`);
            }
            
            // 2. Get all projects from old company to merge annotation history
            const oldProjectsPath = `Companies/${oldCompanyPath}/projects`;
            const oldProjects = await getFirebaseData(oldProjectsPath);
        
        if (oldProjects) {
            for (const [projectName, projectData] of Object.entries(oldProjects)) {
                // Merge annotation history (it's a string representing an object)
                if (projectData.annotationHistory) {
                    const oldAnnotationPath = `Companies/${oldCompanyPath}/projects/${projectName}/annotationHistory`;
                    const newAnnotationPath = `Companies/${newCompanyPath}/projects/${projectName}/annotationHistory`;
                    
                    const oldAnnotationString = await getFirebaseData(oldAnnotationPath);
                    const newAnnotationString = await getFirebaseData(newAnnotationPath);
                    
                    if (oldAnnotationString) {
                        try {
                            // Parse both annotation histories (they should be arrays of arrays)
                            const oldAnnotationArray = JSON.parse(oldAnnotationString);
                            const newAnnotationArray = newAnnotationString ? JSON.parse(newAnnotationString) : [];
                            
                            // Verify they are arrays
                            if (!Array.isArray(oldAnnotationArray)) {
                                console.warn('Old annotation history is not an array, skipping merge');
                                await saveFirebaseData(newAnnotationPath, oldAnnotationString);
                                return;
                            }
                            
                            if (!Array.isArray(newAnnotationArray)) {
                                console.warn('New annotation history is not an array, using old data');
                                await saveFirebaseData(newAnnotationPath, oldAnnotationString);
                                return;
                            }
                            
                            // Merge the two arrays by concatenating them
                            const mergedAnnotation = [...newAnnotationArray, ...oldAnnotationArray];
                            await saveFirebaseData(newAnnotationPath, JSON.stringify(mergedAnnotation));
                            console.log(`Merged annotation history for project: ${projectName}`);
                        } catch (parseError) {
                            console.error('Error parsing annotation history:', parseError);
                            // If parsing fails, just copy the string as is
                            await saveFirebaseData(newAnnotationPath, oldAnnotationString);
                        }
                    }
                }
            }
        }
        
        // 3. Merge categoriesImages
        const oldCategoriesImagesPath = `Companies/${oldCompanyPath}/projects/${currentProject}/categoriesImages`;
        const newCategoriesImagesPath = `Companies/${newCompanyPath}/projects/${currentProject}/categoriesImages`;
        const oldCategoriesImages = await getFirebaseData(oldCategoriesImagesPath);
        
        if (oldCategoriesImages) {
            const newCategoriesImages = await getFirebaseData(newCategoriesImagesPath) || {};
            const mergedCategoriesImages = { ...newCategoriesImages, ...oldCategoriesImages };
            await saveFirebaseData(newCategoriesImagesPath, mergedCategoriesImages);
            console.log('Merged categoriesImages');
        }
        
        // 4. Merge customLabelsAndCodes
        const oldLabelsCodesPath = `Companies/${oldCompanyPath}/projects/${currentProject}/customLabelsAndCodes`;
        const newLabelsCodesPath = `Companies/${newCompanyPath}/projects/${currentProject}/customLabelsAndCodes`;
        const oldLabelsAndCodes = await getFirebaseData(oldLabelsCodesPath);
        
        if (oldLabelsAndCodes) {
            const newLabelsAndCodes = await getFirebaseData(newLabelsCodesPath) || {};
            const mergedLabelsAndCodes = { ...newLabelsAndCodes, ...oldLabelsAndCodes };
            await saveFirebaseData(newLabelsCodesPath, mergedLabelsAndCodes);
            console.log('Merged customLabelsAndCodes');
        }
        
        // 5. Merge highlights
        const oldHighlightsPath = `Companies/${oldCompanyPath}/projects/${currentProject}/highlights`;
        const newHighlightsPath = `Companies/${newCompanyPath}/projects/${currentProject}/highlights`;
        const oldHighlights = await getFirebaseData(oldHighlightsPath);
        
        if (oldHighlights) {
            const newHighlights = await getFirebaseData(newHighlightsPath) || {};
            const mergedHighlights = { ...newHighlights, ...oldHighlights };
            await saveFirebaseData(newHighlightsPath, mergedHighlights);
            console.log('Merged highlights');
        }
        
        // 6. Merge manualLoggingCategories
        const oldManualLoggingPath = `Companies/${oldCompanyPath}/projects/${currentProject}/manualLoggingCategories`;
        const newManualLoggingPath = `Companies/${newCompanyPath}/projects/${currentProject}/manualLoggingCategories`;
        const oldManualLogging = await getFirebaseData(oldManualLoggingPath);
        
        if (oldManualLogging) {
            const newManualLogging = await getFirebaseData(newManualLoggingPath) || {};
            const mergedManualLogging = { ...newManualLogging, ...oldManualLogging };
            await saveFirebaseData(newManualLoggingPath, mergedManualLogging);
            console.log('Merged manualLoggingCategories');
        }
        
        } // End of migration logic for existing users
        
        // 7. Copy user info to new company (only if user has existing company)
        if (oldCompany && oldCompanyPath) {
            const oldUserPath = `Companies/${oldCompanyPath}/users/${userEmailPath}`;
            const newUserPath = `Companies/${newCompanyPath}/users/${userEmailPath}`;
            const userInfo = await getFirebaseData(oldUserPath);
            
            if (userInfo) {
                await saveFirebaseData(newUserPath, userInfo);
                console.log('Copied user info to new company');
            }
            
            // 9. Delete user from old company (only thing we delete)
            await deleteFirebaseData(oldUserPath);
            console.log('Removed user from old company');
        }
        
        // 8. Update emailToCompanyDirectory (store with commas for consistency)
        await saveFirebaseData(`emailToCompanyDirectory/${userEmailPath}`, newCompanyPath);
        console.log('Updated company directory');
        
        // Update local storage (store with periods for display)
        localStorage.setItem('companyEmail', newCompanyPath.replace(/./g, ','));
        
        showToast('Successfully joined new company! Refreshing...', 'success');
        setInviteCode('');
        setIsOpen(false);
        
        // Refresh the page to load new company data
        setTimeout(() => {
            window.location.reload();
        }, 1500);
        
    } catch (error) {
        console.error('Error processing invite code:', error);
        showToast('Failed to process invite code. Please try again.', 'error');
    }
}

// Generate project-level invite code
export async function generateProjectInviteCode(projectId) {
    console.log('Generating project invite code for:', projectId);
    
    // 1. Validate Input
    if (!projectId || typeof projectId !== 'string') {
        showToast('No project selected to share', 'error');
        return null;
    }
    
    // 2. Check Authentication
    if (!auth.currentUser) {
        showToast('User not authenticated', 'error');
        return null;
    }
    
    try {
        const user = auth.currentUser;
        const userEmail = user.email;
        const userEmailPath = userEmail.replace(/\./g, ',');
        
        // 3. Get Company Email (check for shared project first)
        // SECURITY: Verify membership and permissions before using sharedCompanyEmail
        let companyEmail = null;
        const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
        const sharedProjectId = localStorage.getItem('sharedProjectId');
        const currentProject = localStorage.getItem('currentProject');
        
        // Only use sharedCompanyEmail if we're viewing that specific shared project
        if (sharedCompanyEmail && sharedProjectId && currentProject && sharedProjectId === projectId) {
            // SECURITY: Verify user is actually a member of this project
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
                    companyEmail = sharedCompanyEmail;
                } else {
                    showToast('You do not have permission to share this project', 'error');
                    return null;
                }
            } else {
                // SECURITY: Not a member of the shared project - this shouldn't happen if localStorage is valid
                // But for security, we reject the operation rather than silently falling back
                showToast('You are not a member of this project', 'error');
                return null;
            }
        } else {
            // Not viewing a shared project - use user's own company
            companyEmail = localStorage.getItem('companyEmail');
        if (!companyEmail) {
            companyEmail = await getFirebaseData(`emailToCompanyDirectory/${userEmailPath}`);
            }
        }
        
        if (!companyEmail) {
            showToast('Could not resolve company', 'error');
            return null;
        }
        
        const companyEmailPath = companyEmail.replace(/\./g, ',');
        
        // SECURITY: For own projects, verify user owns the company or is a member with share permission
        if (!sharedCompanyEmail || sharedProjectId !== projectId) {
            // This is the user's own project - verify ownership or membership
            const userCompanyEmail = await getFirebaseData(`emailToCompanyDirectory/${userEmailPath}`);
            const userCompanyEmailPath = userCompanyEmail ? userCompanyEmail.replace(/\./g, ',') : null;
            const isOwner = userCompanyEmailPath === companyEmailPath;
            
            if (!isOwner) {
                // Not the owner - check if they're a member with share permission
                const memberData = await getFirebaseData(
                    `Companies/${companyEmailPath}/projects/${projectId}/members/${userEmailPath}`
                );
                
                if (!memberData) {
                    showToast('You do not have access to this project', 'error');
                    return null;
                }
                
                const hasSharePermission = memberData.permissions?.share === true || 
                                         memberData.role === 'owner' ||
                                         !memberData.permissions;
                
                if (!hasSharePermission) {
                    showToast('You do not have permission to share this project', 'error');
                    return null;
                }
            }
        }
        
        // SECURITY: Verify project exists by checking if we can read project members
        // This works for both owners and members (members can read members list)
        try {
            const membersCheck = await getFirebaseData(
                `Companies/${companyEmailPath}/projects/${projectId}/members`
            );
            // If we can't read members, project might not exist or we don't have access
            // But we already verified membership above, so this is just a sanity check
            if (membersCheck === null && !sharedCompanyEmail) {
                // For own projects, verify project exists
                const projectCheck = await getFirebaseData(
                    `Companies/${companyEmailPath}/projects/${projectId}`
                );
                if (!projectCheck) {
                    showToast('Project not found', 'error');
                    return null;
                }
            }
        } catch (error) {
            console.error('Error verifying project existence:', error);
            // Don't block if check fails - we already verified membership
        }
        
        // SECURITY: Basic rate limiting - check recent code generation
        // Store in localStorage (client-side, can be bypassed but provides basic protection)
        const rateLimitKey = `inviteCodeGen_${companyEmailPath}_${projectId}`;
        const rateLimitData = localStorage.getItem(rateLimitKey);
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const maxCodesPerDay = 10;
        
        if (rateLimitData) {
            const { count, timestamp } = JSON.parse(rateLimitData);
            if (now - timestamp < oneDay) {
                if (count >= maxCodesPerDay) {
                    showToast(`Rate limit exceeded. Maximum ${maxCodesPerDay} codes per day per project.`, 'error');
                    return null;
                }
                // Update count
                localStorage.setItem(rateLimitKey, JSON.stringify({
                    count: count + 1,
                    timestamp: timestamp
                }));
            } else {
                // Reset counter (24 hours passed)
                localStorage.setItem(rateLimitKey, JSON.stringify({
                    count: 1,
                    timestamp: now
                }));
            }
        } else {
            // First code generation
            localStorage.setItem(rateLimitKey, JSON.stringify({
                count: 1,
                timestamp: now
            }));
        }
        
        // 4. Generate Code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        let attempts = 0;
        const maxAttempts = 10;
        
        // Ensure uniqueness
        do {
            code = '';
            const randomValues = new Uint8Array(8);
            window.crypto.getRandomValues(randomValues);
            for (let i = 0; i < 8; i++) {
                code += chars[randomValues[i] % chars.length];
            }
            
            // Check if code already exists
            const existingCode = await getFirebaseData(`inviteCodes/${code}`);
            if (!existingCode) {
                break; // Code is unique
            }
            attempts++;
        } while (attempts < maxAttempts);
        
        if (attempts >= maxAttempts) {
            showToast('Failed to generate unique code. Please try again.', 'error');
            return null;
        }
        
        // 5. Save to Firebase
        // SECURITY: Add expiration (30 days from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiration
        
        const inviteCodeData = {
            type: 'project',
            projectId: projectId,
            companyEmail: companyEmailPath,
            createdBy: userEmail,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString() // SECURITY: Expiration timestamp
        };
        
        await saveFirebaseData(`inviteCodes/${code}`, inviteCodeData);
        console.log('Generated invite code:', code);
        
        // SECURITY: Audit logging
        try {
            const auditLog = {
                event: 'invite_code_generated',
                userEmail: userEmail,
                projectId: projectId,
                companyEmail: companyEmailPath,
                code: code,
                expiresAt: expiresAt.toISOString(),
                timestamp: new Date().toISOString()
            };
            // Log to console (can be extended to Firebase later)
            console.log('[AUDIT] Invite code generated:', auditLog);
        } catch (e) {
            console.warn('Failed to log audit event:', e);
        }
        
        // 6. Return the code
        return code;
        
    } catch (error) {
        console.error('Error generating invite code:', error);
        showToast('Failed to generate invite code. Please try again.', 'error');
        return null;
    }
}

// Accept project-level invite code
export async function acceptProjectInviteCode(inviteCode) {
    console.log('Accepting project invite code:', inviteCode);
    
    // 5.1 Validation
    // 1. Validate Input
    if (!inviteCode || !inviteCode.trim()) {
        showToast('Please enter an invite code', 'error');
        return false;
    }
    
    // 2. Check Authentication
    if (!auth.currentUser) {
        showToast('User not authenticated', 'error');
        return false;
    }
    
    try {
        // 5.2 Fetch Invite Code Data
        // 3. Show Loading
        showToast('Processing invite code...', 'info');
        
        // 4. Fetch from Firebase
        const trimmedCode = inviteCode.trim().toUpperCase();
        const inviteData = await getFirebaseData(`inviteCodes/${trimmedCode}`);
        
        if (!inviteData) {
            showToast('Invalid or expired invite code', 'error');
            return false;
        }
        
        // 5.3 Validate Invite Code Type
        // 5. Check Type
        if (inviteData.type !== 'project') {
            showToast('This code is not a project invite', 'error');
            return false;
        }
        
        // SECURITY: Check if code has expired
        if (inviteData.expiresAt) {
            const expiresAt = new Date(inviteData.expiresAt);
            const now = new Date();
            if (now > expiresAt) {
                showToast('This invite code has expired', 'error');
                // Optionally delete expired code
                try {
                    await deleteFirebaseData(`inviteCodes/${trimmedCode}`);
                } catch (e) {
                    console.warn('Failed to delete expired code:', e);
                }
                return false;
            }
        }
        
        // 5.4 Extract Data
        // 6. Extract Information
        const ownerCompanyEmail = inviteData.companyEmail; // Already in comma notation
        const projectId = inviteData.projectId;
        
        if (!ownerCompanyEmail || !projectId) {
            showToast('Malformed invite code', 'error');
            return false;
        }
        
        // Note: We skip company/project existence validation here because:
        // 1. The accepting user doesn't have read permissions to Companies/{companyEmail} yet
        // 2. Firebase rules will enforce proper permissions when we try to write the member data
        // 3. If the project doesn't exist, the write will fail with appropriate error handling
        
        // 5.5 Get Current User Info
        // 7. Get User Email Path
        const user = auth.currentUser;
        const userEmail = user.email;
        const userEmailPath = userEmail.replace(/\./g, ',');
        
        // 8. Get User's Company
        let userCompanyEmail = localStorage.getItem('companyEmail');
        if (!userCompanyEmail) {
            userCompanyEmail = await getFirebaseData(`emailToCompanyDirectory/${userEmailPath}`);
        }
        if (userCompanyEmail) {
            userCompanyEmail = userCompanyEmail.replace(/\./g, ',');
        }
        
        // SECURITY: Rate limiting for code acceptance attempts
        const rateLimitKey = `inviteCodeAccept_${userEmailPath}`;
        const rateLimitData = localStorage.getItem(rateLimitKey);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
        const maxAttemptsPerHour = 10;
        
        if (rateLimitData) {
            const { count, timestamp } = JSON.parse(rateLimitData);
            if (now - timestamp < oneHour) {
                if (count >= maxAttemptsPerHour) {
                    showToast(`Rate limit exceeded. Maximum ${maxAttemptsPerHour} attempts per hour.`, 'error');
                    return false;
                }
                // Update count
                localStorage.setItem(rateLimitKey, JSON.stringify({
                    count: count + 1,
                    timestamp: timestamp
                }));
            } else {
                // Reset counter (1 hour passed)
                localStorage.setItem(rateLimitKey, JSON.stringify({
                    count: 1,
                    timestamp: now
                }));
            }
        } else {
            // First attempt
            localStorage.setItem(rateLimitKey, JSON.stringify({
                count: 1,
                timestamp: now
            }));
        }
        
        // 5.6 Validate Self-Invite Prevention
        // 9. Check Self-Invite
        if (userCompanyEmail && userCompanyEmail === ownerCompanyEmail) {
            showToast('You cannot accept an invite to your own project', 'error');
            return false;
        }
        
        // 5.7 Check Already Member
        // 10. Check Existing Membership
        const existingMember = await getFirebaseData(
            `Companies/${ownerCompanyEmail}/projects/${projectId}/members/${userEmailPath}`
        );
        
        if (existingMember) {
            showToast('You are already a member of this project', 'error');
            return false;
        }
        
        // SECURITY: Use Firebase transaction to prevent race condition and ensure atomicity
        // This ensures: code exists, member doesn't exist, then atomically: add member + create mapping + delete code
        const codeRef = ref(database, `inviteCodes/${trimmedCode}`);
        const memberRef = ref(database, `Companies/${ownerCompanyEmail}/projects/${projectId}/members/${userEmailPath}`);
        const reverseMappingRef = ref(database, `emailToSharedProjects/${userEmailPath}/${ownerCompanyEmail}/${projectId}`);
        
        try {
            const result = await runTransaction(codeRef, (currentCodeData) => {
                // If code doesn't exist or was already used, abort
                if (!currentCodeData || currentCodeData.type !== 'project') {
                    return null; // Abort transaction
                }
                
                // Check expiration
                if (currentCodeData.expiresAt) {
                    const expiresAt = new Date(currentCodeData.expiresAt);
                    if (new Date() > expiresAt) {
                        return null; // Abort transaction (expired)
                    }
                }
                
                // Verify code matches expected project
                if (currentCodeData.projectId !== projectId || currentCodeData.companyEmail !== ownerCompanyEmail) {
                    return null; // Abort transaction (code mismatch)
                }
                
                // Return null to delete the code (single-use)
                return null;
            });
            
            // If transaction succeeded (code was deleted), proceed with member addition
            // Note: Transaction only handles code deletion atomically
            // We still need to add member and reverse mapping, but code is already deleted
            // This prevents race condition where multiple users accept same code
            
            // SECURITY: Use try-catch to handle partial failures and ensure data consistency
            let memberAdded = false;
            let reverseMappingAdded = false;
            
            try {
        // 5.8 Add User as Member
        // 11. Add Membership
        const memberData = {
            role: 'editor',
            joinedAt: new Date().toISOString(),
            email: userEmail,
            permissions: DEFAULT_PERMISSIONS // Include default permissions for new members
        };
        
        await saveFirebaseData(
            `Companies/${ownerCompanyEmail}/projects/${projectId}/members/${userEmailPath}`,
            memberData
        );
                memberAdded = true;
        
        // 5.9 Create Reverse Mapping
        // 12. Create Reverse Mapping
        const sharedProjectData = {
            projectId: projectId,
            ownerCompany: ownerCompanyEmail,
            joinedAt: new Date().toISOString()
        };
        
        await saveFirebaseData(
            `emailToSharedProjects/${userEmailPath}/${ownerCompanyEmail}/${projectId}`,
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
                        await deleteFirebaseData(
                            `Companies/${ownerCompanyEmail}/projects/${projectId}/members/${userEmailPath}`
                        );
                        console.log('Cleaned up partially added member due to reverse mapping failure');
                    } catch (cleanupError) {
                        console.error('Failed to cleanup member after reverse mapping failure:', cleanupError);
                        // Log for manual cleanup - this is a rare edge case
                    }
                }
                
                // Code was already deleted in transaction, so we can't restore it
                // User will need a new code, but at least we prevented data inconsistency
                showToast('Failed to complete invitation. Please contact the project owner for a new invite code.', 'error');
                return false;
            }
            
            // SECURITY: Audit logging
            try {
                const auditLog = {
                    event: 'invite_code_accepted',
                    userEmail: userEmail,
                    projectId: projectId,
                    ownerCompany: ownerCompanyEmail,
                    code: trimmedCode,
                    timestamp: new Date().toISOString()
                };
                // Log to console (can be extended to Firebase later)
                console.log('[AUDIT] Invite code accepted:', auditLog);
            } catch (e) {
                console.warn('Failed to log audit event:', e);
            }
            
        } catch (transactionError) {
            // Transaction failed - code might have been used by another user or doesn't exist
            if (transactionError.message && transactionError.message.includes('abort')) {
                showToast('This invite code has already been used or is no longer valid', 'error');
            } else {
                console.error('Transaction error:', transactionError);
                showToast('Failed to accept invite code. It may have already been used.', 'error');
            }
            return false;
        }
        
        // 5.11 Store pending shared project in Firebase for restoration after reload
        try {
            const pendingSharedProject = {
                projectId: projectId,
                ownerCompany: ownerCompanyEmail,
                joinedAt: new Date().toISOString()
            };
            await setUIState(userEmail, 'pendingSharedProject', pendingSharedProject);
            // Also update localStorage for backward compatibility
            localStorage.setItem('pendingSharedProject', JSON.stringify(pendingSharedProject));
        } catch (e) {
            console.warn('Failed to store pending shared project:', e);
        }
        
        // 5.12 Success and Reload
        // 14. Show Success
        showToast('Successfully joined project!', 'success');
        
        // 15. Reload Page (only if not during signup)
        // During signup, finishSignUp will handle the redirect
        // Check if we're on the auth page or if companyEmail isn't set yet (signup in progress)
        const isDuringSignup = (window.location.pathname && window.location.pathname.includes('/auth')) || 
                               (window.location.hash && window.location.hash.includes('/auth')) ||
                               !localStorage.getItem('companyEmail');
        
        if (!isDuringSignup) {
            // Normal flow: reload the page to show the new shared project
        setTimeout(() => {
            window.location.reload();
            }, 500);
        }
        // During signup, don't reload here - let finishSignUp handle the redirect
        // The shared project will be loaded by the ChatSidebar listener when the page loads
        
        return true;
        
    } catch (error) {
        console.error('Error accepting invite code:', error);
        showToast('Failed to accept invite. Please try again.', 'error');
        return false;
    }
}
