import { createContext, useContext, useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

const AccessContext = createContext();

const OWNER_EMAIL = 'jonathalimax@gmail.com';

export function AccessProvider({ children }) {
  const [userRole, setUserRole] = useState('write');
  const [ownerId, setOwnerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  // Track auth state reactively — auth.currentUser is a mutable property that
  // doesn't trigger React re-renders on its own.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setCurrentUser(user));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const currentUserEmail = currentUser.email?.toLowerCase();

    if (currentUserEmail === OWNER_EMAIL) {
      setUserRole('write');
      setOwnerId(currentUser.uid);
      setLoading(false);
      return;
    }

    const accessRef = doc(db, 'access', 'allowed_emails');
    const unsubscribe = onSnapshot(accessRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const emails = data.emails || [];
        const ownerUid = data.ownerId || null;

        if (emails.length > 0) {
          if (typeof emails[0] === 'string') {
            const isInList = emails.some(e => e.toLowerCase() === currentUserEmail);
            setUserRole('write');
            setOwnerId(isInList && ownerUid ? ownerUid : currentUser.uid);
          } else {
            const userEntry = emails.find(e => e.email?.toLowerCase() === currentUserEmail);
            if (userEntry) {
              setUserRole(userEntry.role || 'write');
              setOwnerId(ownerUid || currentUser.uid);
            } else {
              setUserRole('write');
              setOwnerId(currentUser.uid);
            }
          }
        } else {
          setUserRole('write');
          setOwnerId(currentUser.uid);
        }
      } else {
        setUserRole('write');
        setOwnerId(currentUser.uid);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error loading access control:', error);
      setUserRole('write');
      setOwnerId(currentUser.uid);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const canWrite = userRole === 'write';
  const isReadOnly = userRole === 'read';
  const isOwner = currentUser?.email?.toLowerCase() === OWNER_EMAIL;

  return (
    <AccessContext.Provider value={{
      userRole,
      canWrite,
      isReadOnly,
      isOwner,
      ownerId, // The UID whose data should be viewed
      loading,
      currentUser,
    }}>
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

export { OWNER_EMAIL };
