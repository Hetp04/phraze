# Quick Start Guide: Project Sharing Feature

## How to Use the New Project Sharing Feature

### For Project Owners (Sharing a Project)

1. **Open the Project Dropdown**
   - Click on the project selector button in the sidebar
   - You'll see two tabs: "Private Projects" and "Shared Projects"

2. **Share a Project**
   - In the "Private Projects" tab, find the project you want to share
   - Click the **share icon** (network symbol) next to the project name
   - A modal will open titled "Share Project: [Project Name]"

3. **Generate Invite Code**
   - Click the "Generate Invite Code" button
   - An 8-character code will be generated (e.g., "ABC123XY")
   - Click "Copy Code" to copy it to your clipboard
   - Share this code with your team members via email, Slack, etc.

### For Team Members (Joining a Project)

1. **Open the Project Dropdown**
   - Click on the project selector button in the sidebar
   - Switch to the "Shared Projects" tab

2. **Enter Invite Code**
   - If you have no shared projects, you'll see a button "Enter Invite Code"
   - If you already have shared projects, click "Join Another Project"
   - A modal will open

3. **Join the Project**
   - Type or paste the 8-character invite code
   - The code will automatically convert to uppercase
   - Click "Join Project" when all 8 characters are entered
   - The page will refresh and you'll see the new project in your "Shared Projects" tab

4. **Access the Shared Project**
   - Click on the shared project from the "Shared Projects" tab
   - You'll see a "SHARED" badge next to the project name
   - The system will automatically switch you to "Public" chat mode
   - You can now collaborate with all other project members in real-time!

## Key Features

### Real-Time Collaboration
- All chats, messages, and changes sync instantly across all project members
- Everyone sees the same data at the same time
- No need to refresh - updates appear automatically

### Context Switching
- When you select a shared project, the app automatically switches context
- All chats load from the project owner's company
- Switching back to your private projects returns you to your own data

### Chat Modes in Shared Projects
- Shared projects automatically use "Public" mode
- All chats are visible to all project members
- This ensures everyone can collaborate effectively

### Security
- Invite codes are single-use only (deleted after first acceptance)
- Only people with the invite code can join
- Each project has its own invite code
- Members are explicitly tracked in Firebase

## Visual Indicators

- **Share Icon**: Small network icon appears next to each private project
- **SHARED Badge**: Blue badge shows on projects shared by others
- **Company Email**: Shows which company owns the shared project
- **Tab Counts**: Number of shared projects shown in tab header
- **Checkmark**: Indicates currently selected project

## Tips

1. **Organize Your Projects**: Use "Private Projects" for personal work and "Shared Projects" for team collaboration
2. **Generate New Codes**: Each time you want to add a new person, generate a fresh invite code
3. **Public Mode**: Remember that all chats in shared projects are visible to all members
4. **Context Awareness**: Always check which project you're in before creating chats

## Troubleshooting

### "Invalid invite code" Error
- Check that you entered all 8 characters correctly
- The code might have been used already (single-use)
- Ask the project owner to generate a new code

### "You are already a member" Message
- You've already joined this project
- Check your "Shared Projects" tab to find it
- No action needed

### Can't See Shared Project
- Make sure you successfully accepted the invite
- Try refreshing the page
- Check that you're logged in with the correct account

### Changes Not Syncing
- Check your internet connection
- Make sure you're viewing the same project as other members
- Try refreshing the page

## Best Practices

1. **Name Projects Clearly**: Use descriptive names so team members know what they're joining
2. **Communicate**: Let team members know when you share a project and what it's for
3. **Manage Access**: Only share invite codes with people who need access
4. **Stay Organized**: Use the tab system to keep personal and shared work separate
5. **Check Context**: Before creating important data, verify you're in the right project

## What's Shared in a Project?

When you share a project, collaborators get access to:
- ✅ All chats in the project
- ✅ All messages in those chats
- ✅ All highlights and annotations
- ✅ Real-time updates and changes

They do NOT get access to:
- ❌ Your other private projects
- ❌ Your personal account settings
- ❌ Other company data

## Need Help?

If you encounter any issues or have questions:
1. Check the PROJECT_SHARING_IMPLEMENTATION_SUMMARY.md for technical details
2. Verify you're using the latest version of the app
3. Try logging out and back in
4. Check the browser console for error messages

---

**Enjoy collaborating with your team! 🎉**
