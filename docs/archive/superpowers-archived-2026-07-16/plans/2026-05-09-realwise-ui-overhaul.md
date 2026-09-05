# Realwise App: Bug Fixes & UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical bugs (PWA login, mobile settings, Google account display) and redesign Settings UI with improved category management and reorganized sidebar navigation.

**Architecture:** 
- **Bugs (Tasks 1-3):** Quick fixes to unblock mobile users and fix account display
- **UI Overhaul (Tasks 4-6):** Convert tab-based settings to category list with dedicated pages, improve category UX with collapsible groups, reorganize sidebar into "Follow" and "Configure & Plan" sections

**Tech Stack:** React 19, React Router v7, Firebase Auth, Tailwind CSS v4

---

## Task 1: Add Mobile Hamburger Menu to Settings Page

**Problem:** Settings page has custom header that doesn't include hamburger button. On mobile, user can't access sidebar and gets stuck.

**Files:**
- Modify: `src/pages/Settings.jsx:306-315`

**Steps:**

- [ ] **Step 1: Import hamburger icon and useNavigate**

In `src/pages/Settings.jsx`, update imports at the top:
```javascript
import { Bars3Icon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
```

- [ ] **Step 2: Add sidebar toggle to Settings page**

Replace the sticky header section (lines 307-315) with:
```javascript
const navigate = useNavigate();

const toggleSidebar = () => {
  window.dispatchEvent(new CustomEvent('toggle-sidebar'));
};

// In the JSX, replace the header div:
<div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="relative flex items-center h-14 sm:h-16 px-0">
      {/* Mobile hamburger */}
      <div className="md:hidden flex-shrink-0 z-10">
        <button
          onClick={toggleSidebar}
          className="p-2 -ml-2 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors"
          aria-label="Menu"
        >
          <Bars3Icon className="w-6 h-6" />
        </button>
      </div>
      
      <h1 className="flex-1 text-lg sm:text-xl font-bold text-gray-900 dark:text-white pl-2 md:pl-0">
        {t('settings.title')}
      </h1>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Verify mobile hamburger works**

Test in mobile view:
- Open Settings page on mobile
- Click hamburger icon
- Sidebar should slide in from left
- Click close button in sidebar to verify it closes

- [ ] **Step 4: Commit**

```bash
git add src/pages/Settings.jsx
git commit -m "fix: add mobile hamburger menu to settings page"
```

---

## Task 2: Fix Google Account Display

**Problem:** Google auth users see email prefix instead of proper name/email display. For `jonathalimax@gmail.com`, displayName is null so only prefix shows.

**Files:**
- Modify: `src/pages/Settings.jsx:357-372`

**Steps:**

- [ ] **Step 1: Improve profile section to show full email**

In the profile card (around line 358), replace the text display section:

```javascript
<div className="flex-1 min-w-0">
  <p className="font-bold text-gray-900 dark:text-white truncate">
    {currentUser?.displayName || currentUser?.email?.split('@')[0] || '—'}
  </p>
  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
    {currentUser?.email || '—'}
  </p>
</div>
```

Should become:

```javascript
<div className="flex-1 min-w-0">
  <p className="font-bold text-gray-900 dark:text-white truncate">
    {currentUser?.displayName || currentUser?.email?.split('@')[0] || '—'}
  </p>
  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
    {currentUser?.email || '—'}
  </p>
</div>
```

This ensures email is always visible as a secondary line, with smaller text size to avoid clutter.

- [ ] **Step 2: Test with Google account**

- Log in with your Google account (jonathalimax@gmail.com)
- Go to Settings
- Verify both display name and email are visible
- If displayName is missing (null), should show email prefix in name field and full email below

- [ ] **Step 3: Commit**

```bash
git add src/pages/Settings.jsx
git commit -m "fix: show full email for google accounts in profile"
```

---

## Task 3: Fix PWA Login Persistence

**Problem:** Every time PWA is opened, user must login again. Firebase persistence is configured but might not work properly in PWA mode.

**Files:**
- Check: `src/firebase.js:51-53`
- Check: `public/manifest.json` (verify PWA config)
- Possibly create: Service worker enhancement

**Steps:**

- [ ] **Step 1: Verify Firebase persistence is set to indexedDB**

Open `src/firebase.js` and confirm lines 51-53 have:
```javascript
await setPersistence(auth, indexedDBLocalPersistence).catch(() =>
  setPersistence(auth, browserLocalPersistence)
);
```

This should already be in place. ✓

- [ ] **Step 2: Check if service worker exists and is updated**

Run:
```bash
find public -name "service-worker.js" -o -name "sw.js"
find src -name "*service*worker*"
```

If service worker exists, check if it's configured for Vite. If not found, Vite's default PWA config should handle it.

- [ ] **Step 3: Ensure PWA manifest has correct cache strategy**

Check `public/manifest.json` - it should include:
```json
{
  "name": "Realwise",
  "short_name": "Realwise",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait"
}
```

- [ ] **Step 4: Test PWA login persistence**

Steps to test:
1. Build and deploy locally: `npm run build && npx vite preview`
2. Open in browser, install PWA ("Install" button should appear)
3. Open PWA as standalone app
4. Log in with your account
5. Close the app completely
6. Reopen the PWA
7. **Verify:** You should remain logged in without re-entering credentials

If still not persisting:
- Check browser DevTools → Application → IndexedDB → Should have Firebase entries
- Check Service Worker registration is active
- Verify no auth state clearing on app load

- [ ] **Step 5: Commit (if changes needed)**

If no changes required:
```bash
git commit --allow-empty -m "fix: verify PWA login persistence with indexedDB"
```

If service worker or manifest needed updates, commit those:
```bash
git add public/manifest.json [service-worker-file]
git commit -m "fix: improve PWA persistence configuration"
```

---

## Task 4: Redesign Settings to Remove Tabs and Use Category Navigation

**Problem:** Settings page uses horizontal tabs which don't scale well. Categories should be clickable list items that navigate to dedicated configuration pages.

**Files:**
- Modify: `src/pages/Settings.jsx` (major refactor)
- Create: `src/pages/CategorySettings.jsx` (new dedicated page)

**Steps:**

- [ ] **Step 1: Create new CategorySettings dedicated page**

Create `src/pages/CategorySettings.jsx`:

```javascript
import { useState, useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import PageHeader from '../components/PageHeader';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

export default function CategorySettingsPage() {
  const {
    t,
    language,
    categories,
    allCategories,
    addCategory,
    removeCategory,
    toggleCategory,
  } = useSettings();

  const [expandedType, setExpandedType] = useState('expense');
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [newIncomeCategory, setNewIncomeCategory] = useState('');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);

  const getCustomCategories = (type) => {
    return categories[type].filter(cat => !allCategories[type].includes(cat));
  };

  const isProtectedCategory = (cat) => cat === 'Other' || cat === 'Outros';

  const handleAddCategory = async (type) => {
    const value = type === 'expense' ? newExpenseCategory : newIncomeCategory;
    const success = await addCategory(type, value);
    if (success) {
      if (type === 'expense') {
        setNewExpenseCategory('');
        setShowAddExpense(false);
      } else {
        setNewIncomeCategory('');
        setShowAddIncome(false);
      }
    }
  };

  const CategoryToggle = ({ type, category, color }) => {
    const isEnabled = categories[type].includes(category);
    const isProtected = isProtectedCategory(category);
    const colorClasses = color === 'rose'
      ? { bg: 'bg-rose-500', border: 'border-rose-200 dark:border-rose-800', hoverBg: 'hover:bg-rose-50 dark:hover:bg-rose-900/30' }
      : { bg: 'bg-emerald-500', border: 'border-emerald-200 dark:border-emerald-800', hoverBg: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30' };

    return (
      <button
        onClick={() => toggleCategory(type, category)}
        disabled={isProtected && isEnabled}
        className={`flex items-center gap-3 w-full p-3 rounded-xl border transition-all cursor-pointer
          ${isEnabled
            ? `${colorClasses.border} ${colorClasses.hoverBg} bg-white dark:bg-gray-700`
            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800'
          }
          ${isProtected && isEnabled ? 'cursor-not-allowed' : ''}
        `}
      >
        <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors flex-shrink-0
          ${isEnabled ? colorClasses.bg : 'border-2 border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700'}`}
        >
          {isEnabled && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className={`text-sm font-medium ${isEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
          {category}
        </span>
        {isProtected && isEnabled && (
          <span className="ml-auto text-xs text-gray-400">
            {language === 'pt' ? 'obrigatório' : 'required'}
          </span>
        )}
      </button>
    );
  };

  const CustomCategoryChip = ({ type, category, color }) => {
    const colorClasses = color === 'rose'
      ? 'bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-200'
      : 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-200';

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${colorClasses}`}>
        {category}
        <button
          onClick={() => removeCategory(type, category)}
          className="ml-1 opacity-60 hover:opacity-100"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>
    );
  };

  const CategorySection = ({ type, label, color }) => {
    const isExpanded = expandedType === type;
    const icon = isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Collapsible header */}
        <button
          onClick={() => setExpandedType(isExpanded ? null : type)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${color === 'rose' ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
            <h3 className="font-bold text-gray-900 dark:text-white">{label}</h3>
          </div>
          {icon}
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-4 space-y-4">
            {/* Predefined categories */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {language === 'pt' ? 'Padrão' : 'Default'}
              </p>
              <div className="space-y-2">
                {allCategories[type].map((cat) => (
                  <CategoryToggle key={cat} type={type} category={cat} color={color} />
                ))}
              </div>
            </div>

            {/* Custom categories */}
            <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {t('settings.customCategories')}
              </p>

              {getCustomCategories(type).length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-3">
                  {getCustomCategories(type).map((cat) => (
                    <CustomCategoryChip key={cat} type={type} category={cat} color={color} />
                  ))}
                </div>
              ) : !showAddExpense && !showAddIncome && (
                <p className="text-sm text-gray-400 mb-3">{t('settings.noCustomCategories')}</p>
              )}

              {/* Add custom category */}
              {type === 'expense' && showAddExpense ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newExpenseCategory}
                    onChange={(e) => setNewExpenseCategory(e.target.value)}
                    placeholder={t('settings.categoryPlaceholder')}
                    autoFocus
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-sm focus:ring-0 focus:border-gray-900 dark:focus:border-gray-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCategory('expense');
                      if (e.key === 'Escape') setShowAddExpense(false);
                    }}
                  />
                  <button
                    onClick={() => handleAddCategory('expense')}
                    className="px-4 py-2 bg-rose-500 text-white rounded-xl text-sm font-medium hover:bg-rose-600"
                  >
                    {t('common.add')}
                  </button>
                  <button
                    onClick={() => setShowAddExpense(false)}
                    className="px-3 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : type === 'income' && showAddIncome ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newIncomeCategory}
                    onChange={(e) => setNewIncomeCategory(e.target.value)}
                    placeholder={t('settings.categoryPlaceholder')}
                    autoFocus
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-sm focus:ring-0 focus:border-gray-900 dark:focus:border-gray-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCategory('income');
                      if (e.key === 'Escape') setShowAddIncome(false);
                    }}
                  />
                  <button
                    onClick={() => handleAddCategory('income')}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600"
                  >
                    {t('common.add')}
                  </button>
                  <button
                    onClick={() => setShowAddIncome(false)}
                    className="px-3 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => type === 'expense' ? setShowAddExpense(true) : setShowAddIncome(true)}
                  className={`flex items-center gap-2 text-sm font-medium ${
                    type === 'expense'
                      ? 'text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300'
                      : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('settings.addCustom')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageHeader title={t('settings.categories')} showMonth={false} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 space-y-4">
        <CategorySection type="expense" label={t('settings.expenseCategories')} color="rose" />
        <CategorySection type="income" label={t('settings.incomeCategories')} color="emerald" />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Add CategorySettings route to router**

Find `src/App.jsx` and add the route:
```javascript
import CategorySettingsPage from './pages/CategorySettings';

// In the router config, add:
{
  path: '/settings/categories',
  element: <CategorySettingsPage />
}
```

- [ ] **Step 3: Create BanksSettings page wrapper**

Create `src/pages/BanksSettings.jsx`:
```javascript
import { BanksTabContent } from './Cards';
import PageHeader from '../components/PageHeader';
import { useSettings } from '../contexts/SettingsContext';

export default function BanksSettingsPage() {
  const { t } = useSettings();
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageHeader title={language === 'pt' ? 'Bancos' : 'Banks'} showMonth={false} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        <BanksTabContent />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Add BanksSettings route to router**

In `src/App.jsx`, add:
```javascript
import BanksSettingsPage from './pages/BanksSettings';

// In the router config, add:
{
  path: '/settings/banks',
  element: <BanksSettingsPage />
}
```

- [ ] **Step 5: Simplify Settings.jsx - remove tab logic**

Edit `src/pages/Settings.jsx`:
- Remove lines 38-44 (activeTab state)
- Remove lines 66-70 (tab loading from searchParams)
- Remove lines 317-351 (tabs HTML)
- Remove lines 489-638 (categories tab content)
- Remove lines 812-814 (banks tab content)

Replace with a single content section showing category/banks navigation cards.

- [ ] **Step 6: Test Settings UI redesign**

- Open Settings page
- Verify no tabs are shown
- Click "Categories" card → should navigate to `/settings/categories`
- Verify Categories page shows collapsible expense/income sections
- Test expanding/collapsing sections

- [ ] **Step 7: Commit**

```bash
git add src/pages/Settings.jsx src/pages/CategorySettings.jsx src/pages/BanksSettings.jsx src/App.jsx
git commit -m "refactor: convert settings tabs to category list with dedicated pages"
```

---

## Task 5: Reorganize Sidebar Navigation Into Two Sections

**Problem:** All navigation items are in one group. User needs clear distinction between monitoring/viewing (Follow) and configuration/planning (Configure & Plan).

**Files:**
- Modify: `src/components/Sidebar.jsx:119-131`

**Steps:**

- [ ] **Step 1: Update navigation groups in Sidebar**

In `src/components/Sidebar.jsx`, replace the navigationGroups (lines 119-131):

```javascript
const navigationGroups = useMemo(() => [
  {
    label: 'Follow',
    labelPt: 'Acompanhar',
    items: [
      { name: 'Home', namePt: 'Início', href: '/dashboard', icon: HomeIcon },
      { name: 'Income', namePt: 'Entrada', href: '/income', icon: BanknotesIcon },
      { name: 'Expenses', namePt: 'Despesas', href: '/expenses', icon: ArrowTrendingUpIcon },
      { name: 'Bills', namePt: 'Contas', href: '/bills', icon: BellIcon },
      { name: 'Investments', namePt: 'Investimentos', href: '/investments', icon: CalendarDaysIcon },
    ],
  },
  {
    label: 'Configure & Plan',
    labelPt: 'Configurar & Planejar',
    items: [
      { name: 'Planning', namePt: 'Planejamento', href: '/planning', icon: ChartPieIcon },
      { name: 'Banks', namePt: 'Bancos', href: '/banks', icon: BuildingLibraryIcon },
    ],
  },
], []);
```

- [ ] **Step 2: Test sidebar organization**

Desktop:
- Verify two sections visible with headers
- Click links in each section

Mobile:
- Click hamburger → open sidebar
- Verify two sections visible

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "feat: reorganize sidebar into Follow and Configure & Plan sections"
```

---

## Task 6: Add Language Strings for New UI Elements

**Problem:** New navigation section labels and settings cards need localization strings.

**Files:**
- Modify: `src/locales/pt.json` and `src/locales/en.json`

**Steps:**

- [ ] **Step 1: Add Portuguese strings**

In `src/locales/pt.json`, add:

```json
"sidebar.follow": "Acompanhar",
"sidebar.configurePlan": "Configurar & Planejar"
```

- [ ] **Step 2: Add English strings**

In `src/locales/en.json`, add:

```json
"sidebar.follow": "Follow",
"sidebar.configurePlan": "Configure & Plan"
```

- [ ] **Step 3: Commit**

```bash
git add src/locales/pt.json src/locales/en.json
git commit -m "feat: add i18n strings for new navigation sections"
```

---

## Execution Notes

- Tasks should be executed in order (some depend on previous ones)
- After each task, verify all steps completed as specified
- Stop immediately if verification fails or blocker encountered
- After all tasks complete, use finishing-a-development-branch skill
