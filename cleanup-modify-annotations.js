/**
 * Cleanup Script: Remove modifyAnnotations from Firebase
 * 
 * This script removes the deprecated 'modifyAnnotations' permission from all members
 * in all projects. The permission has been merged into 'createAnnotations'.
 * 
 * Run this script once to clean up existing Firebase data.
 * 
 * Usage:
 * 1. Import this script in your browser console or run it in a Node.js environment
 * 2. Make sure you're authenticated with Firebase
 * 3. Call: cleanupModifyAnnotations()
 */

import { database } from './src/firebase-init.js';
import { ref, get, update, onValue } from 'firebase/database';

/**
 * Removes modifyAnnotations permission from all members in all projects
 */
export async function cleanupModifyAnnotations() {
  try {
    console.log('Starting cleanup of modifyAnnotations permission...');
    
    // Get all companies
    const companiesRef = ref(database, 'Companies');
    const companiesSnapshot = await get(companiesRef);
    
    if (!companiesSnapshot.exists()) {
      console.log('No companies found.');
      return;
    }
    
    const companies = companiesSnapshot.val();
    let totalRemoved = 0;
    
    // Iterate through each company
    for (const [companyId, companyData] of Object.entries(companies)) {
      if (!companyData.projects) continue;
      
      // Iterate through each project
      for (const [projectId, projectData] of Object.entries(companyData.projects)) {
        if (!projectData.members) continue;
        
        // Iterate through each member
        for (const [memberEmail, memberData] of Object.entries(projectData.members)) {
          if (memberData.permissions && memberData.permissions.modifyAnnotations !== undefined) {
            // Remove modifyAnnotations from permissions
            const permissionsPath = `Companies/${companyId}/projects/${projectId}/members/${memberEmail}/permissions`;
            const permissionsRef = ref(database, permissionsPath);
            
            // Get current permissions
            const permissionsSnapshot = await get(permissionsRef);
            if (permissionsSnapshot.exists()) {
              const currentPermissions = permissionsSnapshot.val();
              const { modifyAnnotations, ...updatedPermissions } = currentPermissions;
              
              // Update permissions without modifyAnnotations
              await update(permissionsRef, updatedPermissions);
              
              console.log(`Removed modifyAnnotations from ${memberEmail} in project ${projectId}`);
              totalRemoved++;
            }
          }
        }
      }
    }
    
    console.log(`✅ Cleanup complete! Removed modifyAnnotations from ${totalRemoved} member(s).`);
    return totalRemoved;
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
}

/**
 * Browser console version - paste this into browser console when on the app
 */
export const browserCleanupScript = `
(async function cleanupModifyAnnotations() {
  try {
    console.log('Starting cleanup of modifyAnnotations permission...');
    
    // Import Firebase functions (adjust path as needed)
    const { getDatabase, ref, get, update } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
    const database = getDatabase();
    
    // Get all companies
    const companiesRef = ref(database, 'Companies');
    const companiesSnapshot = await get(companiesRef);
    
    if (!companiesSnapshot.exists()) {
      console.log('No companies found.');
      return;
    }
    
    const companies = companiesSnapshot.val();
    let totalRemoved = 0;
    
    // Iterate through each company
    for (const [companyId, companyData] of Object.entries(companies)) {
      if (!companyData.projects) continue;
      
      // Iterate through each project
      for (const [projectId, projectData] of Object.entries(companyData.projects)) {
        if (!projectData.members) continue;
        
        // Iterate through each member
        for (const [memberEmail, memberData] of Object.entries(projectData.members)) {
          if (memberData.permissions && memberData.permissions.modifyAnnotations !== undefined) {
            // Remove modifyAnnotations from permissions
            const permissionsPath = \`Companies/\${companyId}/projects/\${projectId}/members/\${memberEmail}/permissions\`;
            const permissionsRef = ref(database, permissionsPath);
            
            // Get current permissions
            const permissionsSnapshot = await get(permissionsRef);
            if (permissionsSnapshot.exists()) {
              const currentPermissions = permissionsSnapshot.val();
              const { modifyAnnotations, ...updatedPermissions } = currentPermissions;
              
              // Update permissions without modifyAnnotations
              await update(permissionsRef, updatedPermissions);
              
              console.log(\`Removed modifyAnnotations from \${memberEmail} in project \${projectId}\`);
              totalRemoved++;
            }
          }
        }
      }
    }
    
    console.log(\`✅ Cleanup complete! Removed modifyAnnotations from \${totalRemoved} member(s).\`);
    return totalRemoved;
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
})();
`;
