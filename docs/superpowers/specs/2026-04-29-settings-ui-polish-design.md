# Settings UI Polish — Design Spec

**Date:** 2026-04-29  
**Branch:** feat/productization

## Overview

Four targeted improvements to the Settings page and Sidebar: fill dead space on the General tab, give the config button a visible label, remove the theme toggle from the sidebar, and confirm dark mode defaults to system preference.

---

## 1. General Tab — Wider layout + side-by-side actions

**Problem:** The General tab content is constrained to `max-w-lg`, leaving large empty space on desktop screens.

**Change:**
- `Settings.jsx:355` — change `max-w-lg` to `max-w-2xl` on the general tab container div
- Wrap the **Logout** and **Delete account** cards in a `grid grid-cols-1 sm:grid-cols-2 gap-4` so they sit side by side on desktop, filling the extra horizontal space
- Profile card and Appearance/Notifications card remain full-width stacked above

**Result:** Content fills the available width naturally. No new settings or sections added.

---

## 2. Sidebar — Settings as a full nav-link item

**Problem:** The settings gear icon in the sidebar footer is icon-only with no label, inconsistent with all other nav items.

**Change:**
- Remove the icon-only `NavLink` + `ThemeToggle` row from the sidebar footer (`Sidebar.jsx:107-122`)
- Add a `{ name: 'Settings', namePt: 'Configurações', href: '/settings', icon: Cog6ToothIcon }` entry to the last navigation group in `navigationGroups` (alongside Import and Help)
- The new item uses the exact same `NavLink` pattern as all other nav items — icon + label, active/inactive states

**Result:** Settings is now discoverable, labeled, and visually consistent with the rest of the nav.

---

## 3. Sidebar — Remove ThemeToggle

**Problem:** The ThemeToggle in the sidebar footer is redundant and takes up space that was only there to accompany the icon-only settings button.

**Change:**
- Remove `ThemeToggle` import and its render from `Sidebar.jsx`
- The `ThemeToggle` component file is left in place (may be used in other contexts)
- Dark mode is still controllable via the toggle in Settings > General tab

---

## 4. Dark Mode — System preference default (already correct)

**Verification:** `SettingsContext.jsx:109-113` already implements the correct behavior:
1. On first load, reads `localStorage.getItem('darkMode')`
2. If no saved value, falls back to `window.matchMedia('(prefers-color-scheme: dark)').matches`
3. On every `darkMode` state change, saves to `localStorage`

**Change:** None required. This item is already implemented correctly.

---

## Files Affected

| File | Change |
|------|--------|
| `src/pages/Settings.jsx` | Widen general tab container; wrap logout+delete in 2-col grid |
| `src/components/Sidebar.jsx` | Add Settings to nav group; remove icon-only footer row and ThemeToggle |
| `src/contexts/SettingsContext.jsx` | No change (dark mode behavior already correct) |
