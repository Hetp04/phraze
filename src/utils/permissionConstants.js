/**
 * Permission Constants
 * 
 * Centralized location for permission-related constants to avoid circular dependencies.
 */

/**
 * Default permissions object - all permissions enabled by default
 */
export const DEFAULT_PERMISSIONS = {
  createHighlights: true,
  createAnnotations: true,
  deleteAnnotations: true,
  share: true
};

/**
 * All available permission names
 */
export const PERMISSION_NAMES = Object.keys(DEFAULT_PERMISSIONS);

