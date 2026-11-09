import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const NavDrawerContext = createContext({ open: false, openDrawer: () => {}, closeDrawer: () => {} });

/** State of the mobile navigation drawer (the hamburger menu). Lives in Layout so any screen's header can open it. */
export function NavDrawerProvider({ children }) {
  const [open, setOpen] = useState(false);
  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, openDrawer, closeDrawer }), [open, openDrawer, closeDrawer]);
  return <NavDrawerContext.Provider value={value}>{children}</NavDrawerContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useNavDrawer = () => useContext(NavDrawerContext);
