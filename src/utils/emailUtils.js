/**
 * Email Utility Functions
 * 
 * Handles email sanitization for Firebase paths and validation.
 * Firebase Realtime Database uses commas instead of dots in path keys.
 */

/**
 * Sanitize email for Firebase path usage
 * Replaces dots (.) with commas (,) for use in Firebase paths
 * @param {string} email - User email address
 * @returns {string} - Sanitized email for Firebase
 */
export function sanitizeEmailForFirebase(email) {
  if (!email || typeof email !== 'string') {
    console.warn('[emailUtils] Invalid email provided to sanitizeEmailForFirebase:', email);
    return '';
  }
  return email.replace(/\./g, ',');
}

/**
 * Desanitize email from Firebase path
 * Replaces commas (,) back to dots (.) for display
 * @param {string} email - Sanitized email from Firebase
 * @returns {string} - Normal email format
 */
export function desanitizeEmail(email) {
  if (!email || typeof email !== 'string') {
    console.warn('[emailUtils] Invalid email provided to desanitizeEmail:', email);
    return '';
  }
  return email.replace(/,/g, '.');
}

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if email format is valid
 */
export function validateEmailFormat(email) {
  if (!email || typeof email !== 'string') return false;
  
  // RFC 5322 compliant regex (simplified version)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Normalize email (trim and lowercase)
 * @param {string} email - Email address
 * @returns {string} - Normalized email
 */
export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}
