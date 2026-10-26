import { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { deriveAccessState } from './accessState';

const AccessContext = createContext();

export function AccessProvider({ children }) {
  const { status, user } = useAuth();
  const value = useMemo(() => {
    if (status === 'loading') {
      return {
        userRole: 'write',
        canWrite: true,
        isReadOnly: false,
        isOwner: false,
        access: null,
        ownerId: null,
        loading: true,
        currentUser: null,
      };
    }

    return deriveAccessState(user);
  }, [status, user]);

  return (
    <AccessContext.Provider value={value}>
      {children}
    </AccessContext.Provider>
  );
}

export const useAccess = () => {
  const context = useContext(AccessContext);
  if (!context) {
    throw new Error('useAccess must be used within an AccessProvider');
  }
  return context;
};
