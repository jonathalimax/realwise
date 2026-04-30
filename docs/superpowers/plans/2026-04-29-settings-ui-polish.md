# Settings UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the General tab's empty desktop space, make the Settings nav item labeled and consistent, and remove the redundant ThemeToggle from the sidebar.

**Architecture:** Two files are touched — `Settings.jsx` gets a wider container and a 2-column action row; `Sidebar.jsx` loses its icon-only footer row and gains a full nav-link Settings entry. Dark mode system-preference behaviour is already correct and needs no change.

**Tech Stack:** React 19, Tailwind CSS v4, React Router v7

---

## File Map

- Modify: `src/pages/Settings.jsx` — widen general tab container, side-by-side logout+delete
- Modify: `src/components/Sidebar.jsx` — add Settings to nav group, remove ThemeToggle + footer icon row

---

### Task 1: Widen General tab and put actions side by side

**Files:**
- Modify: `src/pages/Settings.jsx:353-484`

- [ ] **Step 1: Widen the General tab container**

In `src/pages/Settings.jsx`, find line 355:
```jsx
<div className="space-y-6 max-w-lg">
```
Change it to:
```jsx
<div className="space-y-6 max-w-2xl">
```

- [ ] **Step 2: Wrap Logout and Delete cards in a 2-column grid**

Find the Logout card (starts around line 425) and the Delete account card (starts around line 438). Currently they are two sibling `<div>` elements inside the `space-y-6` container. Wrap them together:

**Before** (two standalone divs):
```jsx
            {/* Logout */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                onClick={handleSignOut}
                ...
              >
                ...
              </button>
            </div>

            {/* Delete account */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-rose-200 dark:border-rose-800 overflow-hidden">
              ...
            </div>
```

**After** (wrapped in a responsive grid):
```jsx
            {/* Logout + Delete */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
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
```

- [ ] **Step 3: Verify in the browser**

Run the dev server:
```bash
npm run dev
```
Navigate to `/{clientId}/settings`. On a desktop-width window, the General tab should now fill the available space and the Logout/Delete cards should appear side by side.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Settings.jsx
git commit -m "fix: widen General tab and put logout/delete side by side on desktop"
```

---

### Task 2: Add Settings nav item and remove ThemeToggle from Sidebar

**Files:**
- Modify: `src/components/Sidebar.jsx`

- [ ] **Step 1: Add Settings to the last navigation group**

In `src/components/Sidebar.jsx`, find the `navigationGroups` array (line 24). The last group currently contains Import and Help:

```jsx
  [
    { name: 'Import', namePt: 'Importar', href: '/import', icon: DocumentArrowDownIcon },
    { name: 'Help', namePt: 'Ajuda', href: '/help', icon: QuestionMarkCircleIcon },
  ],
```

Add the Settings entry and import `Cog6ToothIcon` is already imported (line 13). Update the last group:

```jsx
  [
    { name: 'Import', namePt: 'Importar', href: '/import', icon: DocumentArrowDownIcon },
    { name: 'Help', namePt: 'Ajuda', href: '/help', icon: QuestionMarkCircleIcon },
    { name: 'Settings', namePt: 'Configurações', href: '/settings', icon: Cog6ToothIcon },
  ],
```

- [ ] **Step 2: Remove the icon-only footer row and ThemeToggle**

In `SidebarContent`, find the Footer Actions section (around line 106). The current footer contains a `flex items-center justify-between` row with the icon-only settings NavLink and ThemeToggle, followed by the sign-out button:

```jsx
      {/* Footer Actions */}
      <div className="p-4 mt-auto border-t border-gray-100 dark:border-gray-800 space-y-2">
        <div className="flex items-center justify-between px-2 mb-2">
          <NavLink
            to="/settings"
            title="Configurações"
            className={({ isActive }) =>
              `p-2 rounded-xl transition-colors ${
                isActive
                  ? 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`
            }
          >
            <Cog6ToothIcon className="w-5 h-5" />
          </NavLink>
          <ThemeToggle />
        </div>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all uppercase tracking-wide"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
          Sair
        </button>
      </div>
```

Replace with the footer that has only the sign-out button (no icon row, no ThemeToggle):

```jsx
      {/* Footer Actions */}
      <div className="p-4 mt-auto border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all uppercase tracking-wide"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
          Sair
        </button>
      </div>
```

- [ ] **Step 3: Remove unused ThemeToggle import**

At the top of `Sidebar.jsx`, remove the ThemeToggle import:

```jsx
import ThemeToggle from './ThemeToggle';
```

Delete that line entirely.

- [ ] **Step 4: Verify in the browser**

With the dev server running (`npm run dev`), open the sidebar. You should see:
- A **Configurações** nav item in the last group (with the gear icon + label, active/inactive states matching other items)
- No theme toggle in the footer
- Only the red "Sair" button in the footer

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "fix: add labeled Settings nav item, remove icon-only button and ThemeToggle from sidebar"
```
