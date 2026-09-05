# UI Polish: Profile, Settings General Tab & PWA Icon

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the category dropdown stay-open behavior, simplify the sidebar header to show user first name + photo avatar, add a General tab in Settings with profile info / logout / delete account, and generate proper PWA homescreen icons.

**Architecture:** All changes are purely frontend — React state/JSX edits to existing components plus a one-shot Node script to generate PNG icons from the existing `wallet-icon.svg` using sharp.

**Tech Stack:** React, Firebase Auth (`signOut`, `deleteUser`), `sharp` (dev dep, icon generation only)

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/components/ui/CategoryPicker.jsx` |
| Modify | `src/components/ImportModal.jsx` |
| Modify | `src/components/Sidebar.jsx` |
| Modify | `src/pages/Settings.jsx` |
| Modify | `vite.config.js` |
| Replace | `public/pwa-192x192.png` |
| Replace | `public/pwa-512x512.png` |
| Create (temp) | `scripts/gen-icons.mjs` |

---

## Task 1: Fix category dropdown — stay open on selection

**Files:**
- Modify: `src/components/ui/CategoryPicker.jsx` (line 69–72)
- Modify: `src/components/ImportModal.jsx` (line 654–669)

The problem: `CategoryPicker.handleSelect` calls both `onSelect(category)` AND `onClose()`, so clicking an item always closes the picker. Additionally, `ImportModal.handleQuickCategoryChange` calls `setPickerTransactionId(null)` which also closes it. Fix: remove both close calls so only outside-click or Escape closes the picker.

- [ ] **Step 1: Remove `onClose()` from `CategoryPicker.handleSelect`**

In `src/components/ui/CategoryPicker.jsx`, find lines 69–72:
```js
const handleSelect = (category) => {
  onSelect(category);
  onClose();
};
```
Replace with:
```js
const handleSelect = (category) => {
  onSelect(category);
};
```

- [ ] **Step 2: Remove `setPickerTransactionId(null)` from `handleQuickCategoryChange`**

In `src/components/ImportModal.jsx`, find lines 654–669:
```js
const handleQuickCategoryChange = (newCategory) => {
  if (pickerTransactionId === null) return;
  const target = transactions.find(t => t._localId === pickerTransactionId);
  const groupId = target?.installmentGroupId;

  setTransactions(prev => prev.map((t) => {
    const isTarget = t._localId === pickerTransactionId;
    const isSameGroup = groupId && t.installmentGroupId === groupId;
    
    if (isTarget || isSameGroup) {
      return { ...t, category: newCategory, autoCategory: false };
    }
    return t;
  }));
  setPickerTransactionId(null);
};
```
Replace with:
```js
const handleQuickCategoryChange = (newCategory) => {
  if (pickerTransactionId === null) return;
  const target = transactions.find(t => t._localId === pickerTransactionId);
  const groupId = target?.installmentGroupId;

  setTransactions(prev => prev.map((t) => {
    const isTarget = t._localId === pickerTransactionId;
    const isSameGroup = groupId && t.installmentGroupId === groupId;
    
    if (isTarget || isSameGroup) {
      return { ...t, category: newCategory, autoCategory: false };
    }
    return t;
  }));
};
```

- [ ] **Step 3: Verify build passes**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && npm run build 2>&1 | tail -5
```
Expected: `✓ built in`

- [ ] **Step 4: Commit**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && git add src/components/ui/CategoryPicker.jsx src/components/ImportModal.jsx && git commit -m "fix(import): keep category picker open after selection, close only on outside click or Escape"
```

---

## Task 2: Sidebar — first name header + user photo avatar

**Files:**
- Modify: `src/components/Sidebar.jsx` (lines ~109–137)

Two changes in `SidebarContent`:
1. Replace the app name text with the user's first name
2. Replace the rose-gradient wallet icon with the user's photo (if available), fallback to the existing icon
3. Remove the entire user-info card block (the `px-4 pb-3` div with name + email)

- [ ] **Step 1: Replace logo row icon + text, remove user card**

Find the logo section in `SidebarContent` (lines ~109–137):
```jsx
{/* Logo */}
<div className="flex items-center gap-3 p-4">
  <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0">
    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  </div>
  <span className="text-lg font-bold text-gray-900 dark:text-white">{appName}</span>
</div>

{/* User info */}
{user && (
  <div className="px-4 pb-3">
    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
      <div className="w-9 h-9 bg-violet-100 dark:bg-violet-900/50 rounded-full flex items-center justify-center flex-shrink-0">
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <span className="text-violet-600 dark:text-violet-300 font-semibold text-sm">
            {getUserDisplayName(user)?.charAt(0)?.toUpperCase() || '?'}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{getUserDisplayName(user)}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
      </div>
    </div>
  </div>
)}
```

Replace the entire block above with:
```jsx
{/* Logo */}
<div className="flex items-center gap-3 p-4">
  <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
    {user?.photoURL ? (
      <img src={user.photoURL} alt="" className="w-10 h-10 object-cover" />
    ) : (
      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )}
  </div>
  <span className="text-lg font-bold text-gray-900 dark:text-white">
    {user?.displayName?.split(' ')[0] || appName}
  </span>
</div>
```

- [ ] **Step 2: Verify build passes**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && npm run build 2>&1 | tail -5
```
Expected: `✓ built in`

- [ ] **Step 3: Commit**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && git add src/components/Sidebar.jsx && git commit -m "feat(sidebar): show user first name and photo avatar in header, remove user info card"
```

---

## Task 3: Settings — General tab with profile, logout, delete account

**Files:**
- Modify: `src/pages/Settings.jsx`

Add a visible `General` tab as the first tab. Its content: user avatar + name + email (read-only), a Logout button, and a Delete Account button with two-step confirmation (type "DELETE" to confirm).

- [ ] **Step 1: Add imports for Firebase Auth actions**

At the top of `src/pages/Settings.jsx`, the current Firebase import is:
```js
import { db, auth } from '../firebase';
```

After it, add:
```js
import { signOut, deleteUser, onAuthStateChanged } from 'firebase/auth';
```

- [ ] **Step 2: Add state for the General tab**

In the `useState` declarations block (around line 29–46), add:
```js
const [currentUser, setCurrentUser] = useState(auth.currentUser);
const [deleteConfirmText, setDeleteConfirmText] = useState('');
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
const [deletingAccount, setDeletingAccount] = useState(false);
```

- [ ] **Step 3: Subscribe to auth state**

After the existing `useEffect` hooks, add:
```js
useEffect(() => {
  return onAuthStateChanged(auth, setCurrentUser);
}, []);
```

- [ ] **Step 4: Add handleSignOut and handleDeleteAccount functions**

Add these two functions after the `loadAllowedEmails` function:
```js
const handleSignOut = async () => {
  await signOut(auth);
};

const handleDeleteAccount = async () => {
  if (deleteConfirmText !== 'DELETE') return;
  setDeletingAccount(true);
  try {
    await deleteUser(auth.currentUser);
  } catch (err) {
    console.error('Error deleting account:', err);
    setDeletingAccount(false);
    setShowDeleteConfirm(false);
    setDeleteConfirmText('');
  }
};
```

- [ ] **Step 5: Add the General tab button to the tab bar**

Find the tab bar (lines ~280–302):
```jsx
{/* Tabs */}
<div className="sticky top-14 sm:top-16 z-30 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex">
    <button
      onClick={() => setActiveTab('categories')}
```

Insert a new General tab button as the FIRST button inside the flex container, before the categories button:
```jsx
<button
  onClick={() => setActiveTab('general')}
  className={`flex-1 min-w-[80px] py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition whitespace-nowrap ${
    activeTab === 'general'
      ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
  }`}
>
  {language === 'pt' ? 'Geral' : 'General'}
</button>
```

- [ ] **Step 6: Replace the hidden General tab content with the new profile + logout + delete UI**

Find the comment and existing General tab block (lines ~307–475):
```jsx
{/* General Tab — hidden but kept for potential admin access */}
{activeTab === 'general' && (
  <div className="space-y-6">
    {/* Language */}
    ...
  </div>
)}
```

Replace the ENTIRE `{activeTab === 'general' && (...)}` block with:
```jsx
{activeTab === 'general' && (
  <div className="space-y-6 max-w-lg">
    {/* Profile */}
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 flex items-center gap-4">
      <div className="w-16 h-16 rounded-full overflow-hidden bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center flex-shrink-0">
        {currentUser?.photoURL ? (
          <img src={currentUser.photoURL} alt="" className="w-16 h-16 object-cover" />
        ) : (
          <span className="text-2xl font-bold text-violet-600 dark:text-violet-300">
            {currentUser?.displayName?.charAt(0)?.toUpperCase() || currentUser?.email?.charAt(0)?.toUpperCase() || '?'}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 dark:text-white truncate">{currentUser?.displayName || '—'}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{currentUser?.email}</p>
      </div>
    </div>

    {/* Logout */}
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={handleSignOut}
        className="w-full flex items-center gap-3 px-5 py-4 text-left text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        {language === 'pt' ? 'Sair da conta' : 'Sign out'}
      </button>
    </div>

    {/* Delete account */}
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-rose-200 dark:border-rose-800 overflow-hidden">
      {!showDeleteConfirm ? (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full flex items-center gap-3 px-5 py-4 text-left text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          {language === 'pt' ? 'Excluir conta' : 'Delete account'}
        </button>
      ) : (
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
            {language === 'pt' ? 'Tem certeza? Esta ação é irreversível.' : 'Are you sure? This action is irreversible.'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {language === 'pt' ? 'Digite DELETE para confirmar:' : 'Type DELETE to confirm:'}
          </p>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="DELETE"
            className="w-full px-3 py-2 text-sm border border-rose-300 dark:border-rose-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'DELETE' || deletingAccount}
              className="flex-1 py-2 text-sm font-medium rounded-lg bg-rose-600 text-white disabled:opacity-40 hover:bg-rose-700 transition-colors"
            >
              {deletingAccount
                ? (language === 'pt' ? 'Excluindo...' : 'Deleting...')
                : (language === 'pt' ? 'Confirmar exclusão' : 'Confirm delete')}
            </button>
            <button
              onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
              className="flex-1 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {language === 'pt' ? 'Cancelar' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 7: Verify build passes**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && npm run build 2>&1 | tail -5
```
Expected: `✓ built in`

- [ ] **Step 8: Commit**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && git add src/pages/Settings.jsx && git commit -m "feat(settings): add General tab with profile info, logout, and delete account"
```

---

## Task 4: PWA icons — generate proper icons and update manifest config

**Files:**
- Create (temp): `scripts/gen-icons.mjs`
- Replace: `public/pwa-192x192.png`
- Replace: `public/pwa-512x512.png`
- Modify: `vite.config.js`

The `wallet-icon.svg` already has a rose gradient background (512×512, rounded corners) with the wallet design. Use `sharp` (install as dev dep) to rasterize it to PNG at 192 and 512px.

- [ ] **Step 1: Install sharp as a dev dependency**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && npm install --save-dev sharp
```

Expected: sharp appears in `devDependencies` in `package.json`.

- [ ] **Step 2: Create the icon generation script**

Create `scripts/gen-icons.mjs`:
```js
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, '../public/wallet-icon.svg');
const svg = readFileSync(svgPath);

await sharp(svg).resize(192, 192).png().toFile(join(__dirname, '../public/pwa-192x192.png'));
console.log('Generated pwa-192x192.png');

await sharp(svg).resize(512, 512).png().toFile(join(__dirname, '../public/pwa-512x512.png'));
console.log('Generated pwa-512x512.png');
```

- [ ] **Step 3: Run the script to generate icons**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && node scripts/gen-icons.mjs
```

Expected output:
```
Generated pwa-192x192.png
Generated pwa-512x512.png
```

- [ ] **Step 4: Update vite.config.js manifest**

In `vite.config.js`, find the `manifest` object inside `VitePWA({...})`. The current manifest is:
```js
manifest: {
  name: 'Moneywise',
  short_name: 'Moneywise',
  start_url: '/app/dashboard',
  description: 'Controle financeiro pessoal simples e eficiente.',
  theme_color: '#ffffff',
  icons: [
    {
      src: 'pwa-192x192.png',
      sizes: '192x192',
      type: 'image/png',
    },
    {
      src: 'pwa-512x512.png',
      sizes: '512x512',
      type: 'image/png',
    },
  ],
},
```

Replace with:
```js
manifest: {
  name: 'Moneywise',
  short_name: 'Moneywise',
  start_url: '/app/dashboard',
  description: 'Controle financeiro pessoal simples e eficiente.',
  theme_color: '#f43f5e',
  background_color: '#f43f5e',
  display: 'standalone',
  icons: [
    {
      src: 'pwa-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any maskable',
    },
    {
      src: 'pwa-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable',
    },
  ],
},
```

- [ ] **Step 5: Verify build passes**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && npm run build 2>&1 | tail -5
```
Expected: `✓ built in`

- [ ] **Step 6: Commit**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && git add public/pwa-192x192.png public/pwa-512x512.png vite.config.js scripts/gen-icons.mjs && git commit -m "feat(pwa): generate proper homescreen icons from wallet-icon.svg, update theme color to rose-500"
```

---

## Task 5: Push and deploy

- [ ] **Step 1: Push to remote**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && git push
```

- [ ] **Step 2: Deploy to Firebase Hosting**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && firebase deploy --only hosting
```

Expected: deployment URL printed, `Deploy complete!`
