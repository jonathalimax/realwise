# UI Polish: Profile, Settings General Tab & PWA Icon

**Date:** 2026-04-25
**Status:** Approved

## Overview

Five targeted UI changes: category dropdown stay-open behavior, sidebar header simplification, user photo avatar, Settings General tab, and proper PWA homescreen icon.

## Changes

### 1. Category Dropdown — Stay Open on Selection

**File:** `src/components/ui/CategoryPicker.jsx`, `src/components/ImportModal.jsx`

- Remove `onClose()` call from `CategoryPicker.handleSelect` — selecting an option no longer closes the dropdown
- Remove `setPickerTransactionId(null)` from `ImportModal.handleQuickCategoryChange` — picker stays open after selection
- Dropdown only closes via outside click or Escape key (already implemented)

### 2. Sidebar Header — Icon + First Name

**File:** `src/components/Sidebar.jsx`

- Replace `{appName}` text in the logo row with user's first name: `user?.displayName?.split(' ')[0] || appName`
- Remove the entire user-info card block (the `px-4 pb-3` div containing name + email)

### 3. Sidebar Avatar — User Photo

**File:** `src/components/Sidebar.jsx`

- The rose-gradient wallet icon in the header becomes the user's avatar: if `user.photoURL` is set, render `<img>` as a rounded avatar (same 40×40 size); if not, keep the current wallet icon in the gradient background

### 4. Settings — General Tab

**File:** `src/pages/Settings.jsx`

- Add `'general'` as the first tab
- General tab content:
  - User avatar (photo if available, else initial) + display name + email (read-only)
  - Logout button (calls `signOut(auth)`)
  - Delete account button — triggers a two-step confirmation:
    1. First click: shows inline warning "This will permanently delete your account and all data. Type DELETE to confirm."
    2. User types "DELETE" → confirm button becomes active → calls `deleteUser(auth.currentUser)` then redirects to login

### 5. PWA Icon

**Files:** `public/pwa-192x192.png`, `public/pwa-512x512.png`, `vite.config.js`

- Generate proper PNG icons from `public/wallet-icon.svg` using a Node script with Sharp or Canvas:
  - Rose-500 (`#f43f5e`) background, white wallet icon centered
  - 192×192 and 512×512 sizes
- Update `vite.config.js`:
  - `theme_color: '#f43f5e'`
  - `background_color: '#f43f5e'`
  - Add `purpose: 'any maskable'` to each icon entry

## Out of Scope

- Editing user profile (name, photo) from within the app
- Multiple account providers / re-authentication flow for delete
