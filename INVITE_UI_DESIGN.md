# Invite System UI Design

## Overview
Complete UI for managing invite codes and company members - all done through the interface, no backend access needed.

---

## 1. Profile Dropdown Menu (Enhanced)

### Current Location: Profile Icon → Dropdown

```
┌─────────────────────────────────┐
│  alice@company.com              │
├─────────────────────────────────┤
│  ⚙️  Account Settings           │
│  👥  Invite Account             │
│  📋  Manage Invites             │  ← NEW
│  👤  Company Members            │  ← NEW
├─────────────────────────────────┤
│  Enter invite code:             │
│  ┌───────────────────────────┐  │
│  │ ABC123XY                  │  │
│  └───────────────────────────┘  │
│  [ Use Invite Code ]            │
├─────────────────────────────────┤
│  🚪  Log out                    │
└─────────────────────────────────┘
```

---

## 2. "Invite Account" Modal (Enhanced)

### When clicking "Invite Account"

```
┌─────────────────────────────────────────────┐
│  ✕                                          │
│                                             │
│  📤 Generate Invite Code                    │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │  ABC123XY                             │ │
│  │  [📋 Copy] [🔗 Share Link] [📱 QR]   │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  ✅ Code copied to clipboard!               │
│                                             │
│  ────────────────────────────────────────  │
│                                             │
│  📊 Code Statistics                         │
│  • Created: Jan 15, 2024                   │
│  • Times used: 5                           │
│  • Status: Active                          │
│                                             │
│  [ Generate New Code ]                     │
└─────────────────────────────────────────────┘
```

---

## 3. "Manage Invites" Page (NEW)

### When clicking "Manage Invites"

```
┌─────────────────────────────────────────────────────┐
│  ← Back                    Manage Invite Codes      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  [+ Generate New Code]                              │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ ABC123XY                    [Active] [Copy]  │  │
│  │ Created: Jan 15, 2024                        │  │
│  │ Used: 5 times                                │  │
│  │ Last used: 2 hours ago                       │  │
│  │ [View Users] [Deactivate]                    │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ XYZ789AB                  [Active] [Copy]    │  │
│  │ Created: Jan 16, 2024                        │  │
│  │ Used: 2 times                                │  │
│  │ Last used: 1 day ago                         │  │
│  │ [View Users] [Deactivate]                    │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ DEF456GH              [Inactive] [Copy]      │  │
│  │ Created: Jan 10, 2024                        │  │
│  │ Used: 0 times                                │  │
│  │ Deactivated: Jan 12, 2024                    │  │
│  │ [Reactivate] [Delete]                        │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 4. "Company Members" Page (NEW)

### When clicking "Company Members"

```
┌─────────────────────────────────────────────────────┐
│  ← Back              Company Members (8)            │
├─────────────────────────────────────────────────────┤
│                                                      │
│  🔍 Search members...                                │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ 👤  Alice Smith                              │  │
│  │     alice@company.com                        │  │
│  │     Founder • Joined: Jan 1, 2024            │  │
│  │     [Message] [View Profile]                 │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ 👤  Bob Johnson                              │  │
│  │     bob@company.com                          │  │
│  │     Member • Joined: Jan 15, 2024            │  │
│  │     Invited by: Alice (Code: ABC123XY)       │  │
│  │     [Message] [View Profile]                 │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ 👤  Charlie Brown                            │  │
│  │     charlie@company.com                      │  │
│  │     Member • Joined: Jan 15, 2024            │  │
│  │     Invited by: Alice (Code: ABC123XY)       │  │
│  │     [Message] [View Profile]                 │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ 👤  David Wilson                             │  │
│  │     david@company.com                        │  │
│  │     Member • Joined: Jan 16, 2024            │  │
│  │     Invited by: Bob (Code: XYZ789AB)         │  │
│  │     [Message] [View Profile]                 │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ... and 4 more members                             │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 5. Invite Code Details Modal (NEW)

### When clicking "View Users" on a code

```
┌─────────────────────────────────────────────┐
│  ✕                                          │
│                                             │
│  📋 Invite Code: ABC123XY                   │
│                                             │
│  Status: [Active]                           │
│  Created: Jan 15, 2024                      │
│  Times used: 5                              │
│                                             │
│  ────────────────────────────────────────  │
│                                             │
│  👥 Users who joined with this code:        │
│                                             │
│  • Bob Johnson                              │
│    Joined: Jan 15, 2024 at 10:30 AM        │
│                                             │
│  • Charlie Brown                            │
│    Joined: Jan 15, 2024 at 11:15 AM        │
│                                             │
│  • Emma Davis                               │
│    Joined: Jan 15, 2024 at 2:45 PM         │
│                                             │
│  • Frank Miller                             │
│    Joined: Jan 16, 2024 at 9:20 AM         │
│                                             │
│  • Grace Lee                                │
│    Joined: Jan 16, 2024 at 3:10 PM         │
│                                             │
│  ────────────────────────────────────────  │
│                                             │
│  [Copy Code] [Deactivate] [Close]          │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 6. Share Invite Code Modal (NEW)

### When clicking "Share Link" or "QR"

```
┌─────────────────────────────────────────────┐
│  ✕                                          │
│                                             │
│  📤 Share Invite Code                       │
│                                             │
│  Code: ABC123XY                             │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │                                       │ │
│  │         [QR CODE IMAGE]               │ │
│  │                                       │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  Share Link:                                │
│  ┌───────────────────────────────────────┐ │
│  │ https://phraze.app/join/ABC123XY      │ │
│  │ [📋 Copy Link]                        │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  Or share via:                              │
│  [📧 Email] [💬 Slack] [📱 WhatsApp]       │
│                                             │
│  [Close]                                    │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 7. Signup Page (Enhanced)

### When new user signs up

```
┌─────────────────────────────────────────────┐
│                                             │
│  Create Account                             │
│                                             │
│  Name:                                      │
│  ┌───────────────────────────────────────┐ │
│  │                                       │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  Email:                                     │
│  ┌───────────────────────────────────────┐ │
│  │                                       │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  Password:                                  │
│  ┌───────────────────────────────────────┐ │
│  │                                       │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  Invite Code (Optional):                    │
│  ┌───────────────────────────────────────┐ │
│  │ ABC123XY                              │ │
│  │ [Scan QR Code]                        │ │
│  └───────────────────────────────────────┘ │
│  💡 Have an invite code? Join your team!   │
│                                             │
│  [Sign Up]                                  │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 8. Notification Toast (NEW)

### When someone joins using your code

```
┌─────────────────────────────────────────────┐
│  ✅ Bob Johnson joined using code ABC123XY  │
│     [View] [Dismiss]                        │
└─────────────────────────────────────────────┘
```

---

## UI Component Structure

### Components Needed:

1. **InviteCodeModal** - Generate and share codes
2. **ManageInvitesPage** - List all codes with stats
3. **CompanyMembersPage** - List all company members
4. **InviteCodeDetailsModal** - View code details and users
5. **ShareInviteModal** - QR code and share options
6. **InviteNotification** - Toast notifications

### Data to Display:

- **Invite Codes:**
  - Code string
  - Created date
  - Times used
  - Last used date
  - Status (Active/Inactive)
  - List of users who used it

- **Company Members:**
  - Name
  - Email
  - Profile picture
  - Join date
  - Role (Founder/Member)
  - Who invited them
  - Which code they used

---

## User Flows

### Flow 1: Generate and Share Code
1. Click Profile → "Invite Account"
2. Modal opens with generated code
3. Click "Copy" or "Share Link"
4. Share with team
5. Code stays active for reuse

### Flow 2: View Company Members
1. Click Profile → "Company Members"
2. See all members in company
3. See who invited whom
4. Click member to message/view profile

### Flow 3: Manage Codes
1. Click Profile → "Manage Invites"
2. See all generated codes
3. View stats for each code
4. Deactivate/reactivate codes
5. See who used which code

### Flow 4: Join with Code
1. Go to signup page
2. Enter invite code (or scan QR)
3. Create account
4. Automatically join company
5. See all members in contacts

---

## Features

✅ Generate unlimited invite codes
✅ View all active/inactive codes
✅ See code usage statistics
✅ Track who used which code
✅ View all company members
✅ See invite relationships
✅ Share codes via link/QR/email
✅ Deactivate/reactivate codes
✅ Real-time notifications when someone joins
✅ Search members
✅ All done through UI - no backend access needed

