# Permission System Setup Guide

This document explains how to set up read-only permissions for users to view another user's financial data.

## Overview

The permission system allows:
- **Owner (you)**: Full read/write access to your own data
- **Read-only users**: View-only access to the owner's data (no add/edit/delete buttons)

## Setup Instructions

### 1. Add ownerId to Firestore Access Document

You need to add your user ID to the `access/allowed_emails` document in Firestore:

1. **Get your User ID:**
   - Open your browser's Developer Console (F12)
   - Go to the Console tab
   - Run: `firebase.auth().currentUser.uid`
   - Copy the UID that is returned

2. **Update Firestore:**
   - Go to Firebase Console → Firestore Database
   - Navigate to the `access` collection
   - Open the `allowed_emails` document
   - Add a new field:
     - Field name: `ownerId`
     - Field type: `string`
     - Value: [paste your UID from step 1]

3. **Verify the structure:**
   Your `access/allowed_emails` document should look like this:
   ```json
   {
     "ownerId": "your-user-id-here",
     "emails": [
       {
         "email": "wife@example.com",
         "role": "read"
       }
     ]
   }
   ```

### 2. Grant Read-Only Access to Users

To give someone read-only access:

1. Go to Settings → Access Control
2. Add their email address
3. Select "Read Only" as the role
4. Click "Add"

### 3. How It Works

**For the Owner (you):**
- You see all your data
- You can add, edit, and delete transactions, goals, bills, etc.
- All buttons and forms are visible

**For Read-Only Users:**
- They see the owner's data (not their own)
- All add/edit/delete buttons are hidden
- They can only view the dashboard, charts, and reports
- They cannot modify any data

## Testing

To test read-only access:

1. Log out
2. Log in with a read-only user account
3. Verify:
   - You see the owner's transactions (not empty)
   - The FAB menu (+ button) is hidden
   - "Manage", "Configure", "Edit" buttons are hidden
   - Clicking on items doesn't open edit modals

## Troubleshooting

**Problem: Read-only user sees their own empty data instead of owner's data**
- Solution: Make sure you added the `ownerId` field to Firestore (Step 1)

**Problem: Read-only user still sees edit buttons**
- Solution: Refresh the page and clear browser cache

**Problem: Permission denied errors**
- Solution: Check Firestore security rules allow read access for the user's email

## Technical Details

### Data Flow

1. When a user logs in, `AccessContext` determines their role
2. If role is "read", it fetches the `ownerId` from Firestore
3. All data contexts (transactions, goals, bills, etc.) use `ownerId` instead of current user's ID
4. UI components check `canWrite` permission to show/hide mutation buttons

### Modified Files

- `/src/contexts/AccessContext.jsx` - Added ownerId tracking
- `/src/contexts/BudgetContext.jsx` - Use ownerId for queries
- `/src/contexts/BillsContext.jsx` - Use ownerId for queries
- `/src/contexts/GoalsContext.jsx` - Use ownerId for queries
- `/src/contexts/InvestmentContext.jsx` - Use ownerId for queries
- `/src/contexts/CardsContext.jsx` - Use ownerId for queries
- `/src/contexts/SettingsContext.jsx` - Use ownerId for queries
- `/src/components/Dashboard.jsx` - Use ownerId for transactions query
- `/src/components/GoalProgress.jsx` - Hide edit buttons for read-only
- `/src/components/WalletCards.jsx` - Hide manage button for read-only
- `/src/components/BudgetCategorySection.jsx` - Hide configure button for read-only
- `/src/components/RuleComparison.jsx` - Hide configure button for read-only
- `/src/components/TransactionList.jsx` - Already had canWrite checks
- `/src/components/BillsList.jsx` - Already had canWrite checks

## Security Considerations

- Read-only users cannot modify data through the UI
- Firestore security rules should also enforce read-only access at the database level
- The owner's UID is not exposed to read-only users in the UI
- Read-only users can only see data from the account that granted them access
