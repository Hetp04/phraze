// Utility to handle asset paths for both local development and GitHub Pages
export const getAssetPath = (path) => {
  // Check if we're in development mode or local preview
  const isDev = import.meta.env.DEV;
  const isGitHubPages = window.location.hostname === 'hetp04.github.io';
  const isCustomDomain = window.location.hostname === 'phrazeapp.ai';
  
  // For GitHub Pages subdirectory, use /phraze/ base path
  // For custom domain, use root base path
  // For everything else (dev and local preview), use relative paths
  if (isGitHubPages) {
    return `/phraze${path}`;
  } else if (isCustomDomain) {
    return path; // Custom domain serves from root
  } else {
    return path;
  }
};

// Helper functions for common assets
export const getImagePath = (filename) => getAssetPath(`/${filename}`);
export const getVideoPath = (filename) => getAssetPath(`/${filename}`);
export const getAudioPath = (filename) => getAssetPath(`/${filename}`);
