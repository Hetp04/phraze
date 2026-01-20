/**
 * Permissions Utility Functions
 * 
 * Handles granular permission checking for editor roles in projects.
 * Owners always have all permissions. Editors have configurable permissions.
 */

import { getFirebaseData } from '../funcs';
import { auth } from '../firebase-init';
import { DEFAULT_PERMISSIONS, PERMISSION_NAMES } from './permissionConstants';

// Re-export for backward compatibility
export { DEFAULT_PERMISSIONS, PERMISSION_NAMES };

/**
 * Check if a user is the project owner
 * @param {string} userEmail - User's email
 * @param {string} companyEmail - Company email that owns the project
 * @returns {Promise<boolean>} - True if user owns the company
 */
export async function isProjectOwner(userEmail, companyEmail) {
  if (!userEmail || !companyEmail) return false;
  
  try {
    const userEmailFormatted = userEmail.replace(/\./g, ',');
    const userCompanyEmail = await getFirebaseData(`emailToCompanyDirectory/${userEmailFormatted}`);
    
    if (!userCompanyEmail) return false;
    
    // Normalize both emails for comparison (handle both comma and dot formats)
    const normalizedUserCompany = userCompanyEmail.replace(/\./g, ',');
    const normalizedTargetCompany = companyEmail.replace(/\./g, ',');
    
    return normalizedUserCompany === normalizedTargetCompany;
  } catch (error) {
    console.error('Error checking project ownership:', error);
    return false;
  }
}

/**
 * Check if user is project owner (synchronous version using localStorage)
 * This is faster but less accurate - use for quick checks only
 * @param {string} companyEmail - Company email that owns the project
 * @returns {boolean} - True if current user likely owns the company
 */
export function isProjectOwnerSync(companyEmail) {
  if (!companyEmail || !auth.currentUser) return false;
  
  const userCompanyEmail = localStorage.getItem('companyEmail');
  if (!userCompanyEmail) return false;
  
  // Normalize both emails for comparison
  const normalizedUserCompany = userCompanyEmail.replace(/\./g, ',');
  const normalizedTargetCompany = companyEmail.replace(/\./g, ',');
  
  return normalizedUserCompany === normalizedTargetCompany;
}

/**
 * Get user's permissions for a project
 * Owners always have all permissions. Editors have configurable permissions.
 * @param {string} userEmail - User's email (formatted with dots)
 * @param {string} companyEmail - Company email that owns the project
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} - Permissions object with boolean values
 */
export async function getUserPermissions(userEmail, companyEmail, projectId) {
  if (!userEmail || !companyEmail || !projectId) {
    console.warn('getUserPermissions: Missing required parameters');
    return DEFAULT_PERMISSIONS;
  }

  try {
    // Owners always have all permissions
    const isOwner = await isProjectOwner(userEmail, companyEmail);
    if (isOwner) {
      return DEFAULT_PERMISSIONS;
    }

    // Get member data from Firebase
    const userEmailFormatted = userEmail.replace(/\./g, ',');
    const companyEmailFormatted = companyEmail.replace(/\./g, ',');
    const memberPath = `Companies/${companyEmailFormatted}/projects/${projectId}/members/${userEmailFormatted}`;
    const memberData = await getFirebaseData(memberPath);

    if (!memberData) {
      // Not a member - return default permissions (could be adjusted based on requirements)
      console.warn(`User ${userEmail} is not a member of project ${projectId}`);
      return DEFAULT_PERMISSIONS;
    }

    // If member has no permissions field, return defaults (backward compatibility)
    if (!memberData.permissions || typeof memberData.permissions !== 'object') {
      return DEFAULT_PERMISSIONS;
    }

    // Merge user permissions with defaults (allows partial permission objects)
    // This ensures if new permissions are added, they default to true
    const userPermissions = memberData.permissions;
    return {
      ...DEFAULT_PERMISSIONS,
      ...userPermissions
    };
  } catch (error) {
    console.error('Error getting user permissions:', error);
    // Return defaults on error to avoid blocking functionality
    return DEFAULT_PERMISSIONS;
  }
}

/**
 * Check if user has a specific permission
 * @param {string} userEmail - User's email (formatted with dots)
 * @param {string} companyEmail - Company email that owns the project
 * @param {string} projectId - Project ID
 * @param {string} permissionName - Name of the permission to check
 * @returns {Promise<boolean>} - True if user has the permission
 */
export async function hasPermission(userEmail, companyEmail, projectId, permissionName) {
  if (!permissionName || !PERMISSION_NAMES.includes(permissionName)) {
    console.warn(`Invalid permission name: ${permissionName}`);
    return false;
  }

  const permissions = await getUserPermissions(userEmail, companyEmail, projectId);
  return permissions[permissionName] === true;
}

/**
 * Check if a permission is enabled in a permissions object
 * Helper function for use with cached permissions
 * @param {Object} permissions - Permissions object
 * @param {string} permissionName - Name of the permission to check
 * @returns {boolean} - True if permission is enabled
 */
export function isPermissionEnabled(permissions, permissionName) {
  if (!permissions || typeof permissions !== 'object') {
    return false;
  }

  if (!permissionName || !PERMISSION_NAMES.includes(permissionName)) {
    console.warn(`Invalid permission name: ${permissionName}`);
    return false;
  }

  // Default to true if permission is not specified (backward compatibility)
  return permissions[permissionName] !== false;
}

/**
 * Get permissions for current user (convenience function)
 * Uses current user from auth and gets company/project from context
 * @param {string} companyEmail - Company email that owns the project
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} - Permissions object with boolean values
 */
export async function getCurrentUserPermissions(companyEmail, projectId) {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.email) {
    console.warn('getCurrentUserPermissions: No authenticated user');
    return DEFAULT_PERMISSIONS;
  }

  return getUserPermissions(currentUser.email, companyEmail, projectId);
}

/**
 * Validate permissions object structure
 * @param {Object} permissions - Permissions object to validate
 * @returns {Object} - Validated permissions object (merged with defaults)
 */
export function validatePermissions(permissions) {
  if (!permissions || typeof permissions !== 'object') {
    return DEFAULT_PERMISSIONS;
  }

  // Merge with defaults to ensure all permissions are present
  const validated = { ...DEFAULT_PERMISSIONS };
  
  PERMISSION_NAMES.forEach(permissionName => {
    if (permissions.hasOwnProperty(permissionName)) {
      // Only allow boolean values
      if (typeof permissions[permissionName] === 'boolean') {
        validated[permissionName] = permissions[permissionName];
      }
    }
  });

  return validated;
}

