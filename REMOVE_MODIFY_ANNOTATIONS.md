# Remove modifyAnnotations from Firebase

## Why is modifyAnnotations still in Firebase?

The `modifyAnnotations` permission has been merged into `createAnnotations` in the code, but existing Firebase data still contains the old `modifyAnnotations` field. This is harmless (the code ignores it), but you can clean it up.

## Automatic Cleanup

**Good news!** The code will automatically remove `modifyAnnotations` when you:
1. Open the permissions modal for any editor
2. Toggle any permission
3. Save the permissions

The `handlePermissionUpdate` function now only saves the 4 permissions (without `modifyAnnotations`), which will overwrite and remove it from Firebase.

## Manual Cleanup (Browser Console)

If you want to clean up all `modifyAnnotations` entries at once, paste this into your browser console while logged into the app:

```javascript
(async function cleanupModifyAnnotations() {
  const { database } = await import('./src/firebase-init.js');
  const { ref, get, update } = await import('firebase/database');
  
  try {
    console.log('Starting cleanup...');
    const companiesRef = ref(database, 'Companies');
    const companiesSnapshot = await get(companiesRef);
    
    if (!companiesSnapshot.exists()) {
      console.log('No companies found.');
      return;
    }
    
    const companies = companiesSnapshot.val();
    let totalRemoved = 0;
    
    for (const [companyId, companyData] of Object.entries(companies)) {
      if (!companyData.projects) continue;
      
      for (const [projectId, projectData] of Object.entries(companyData.projects)) {
        if (!projectData.members) continue;
        
        for (const [memberEmail, memberData] of Object.entries(projectData.members)) {
          if (memberData.permissions && memberData.permissions.modifyAnnotations !== undefined) {
            const permissionsPath = `Companies/${companyId}/projects/${projectId}/members/${memberEmail}/permissions`;
            const permissionsRef = ref(database, permissionsPath);
            
            const permissionsSnapshot = await get(permissionsRef);
            if (permissionsSnapshot.exists()) {
              const currentPermissions = permissionsSnapshot.val();
              const { modifyAnnotations, ...updatedPermissions } = currentPermissions;
              
              await update(permissionsRef, updatedPermissions);
              console.log(`✅ Removed from ${memberEmail} in project ${projectId}`);
              totalRemoved++;
            }
          }
        }
      }
    }
    
    console.log(`🎉 Cleanup complete! Removed from ${totalRemoved} member(s).`);
  } catch (error) {
    console.error('Error:', error);
  }
})();
```

## Manual Cleanup (Firebase Console)

1. Go to Firebase Console → Realtime Database
2. Navigate to: `Companies/{companyEmail}/projects/{projectId}/members/{memberEmail}/permissions`
3. Click the trash icon next to `modifyAnnotations`
4. Repeat for all members in all projects

## What Changed

- ✅ UI label updated to "Create/Modify Annotations"
- ✅ Code no longer uses `modifyAnnotations`
- ✅ Permission save functions exclude `modifyAnnotations`
- ✅ Firebase rules updated (no longer check `modifyAnnotations`)
- ⚠️ Existing Firebase data still has `modifyAnnotations` (harmless, will be removed on next permission update)
