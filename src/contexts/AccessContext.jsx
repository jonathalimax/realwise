import { createContext, useContext, useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

const AccessContext = createContext();

const OWNER_EMAIL = 'jonathalimax@gmail.com';

export function AccessProvider({ children }) {
  const [userRole, setUserRole] = useState('write'); // Default to write for backward compatibility
  const [ownerId, setOwnerId] = useState(null); // Track the owner's UID whose data should be viewed
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    const currentUserEmail = auth.currentUser.email?.toLowerCase();

    // Owner always has write access and views their own data
    if (currentUserEmail === OWNER_EMAIL) {
      setUserRole('write');
      setOwnerId(auth.currentUser.uid);
      setLoading(false);
      return;
    }

    // Listen to access control changes in real-time
    const accessRef = doc(db, 'access', 'allowed_emails');
    const unsubscribe = onSnapshot(accessRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const emails = data.emails || [];
        const ownerUid = data.ownerId || null; // Get owner's UID from access document

        // Handle both old format (array of strings) and new format (array of objects)
        if (emails.length > 0) {
          if (typeof emails[0] === 'string') {
            // Old format - default to write
            const isInList = emails.some(e => e.toLowerCase() === currentUserEmail);
            setUserRole(isInList ? 'write' : 'write');
            // If user is in the allowed list and owner's UID is available, use it
            setOwnerId(isInList && ownerUid ? ownerUid : auth.currentUser.uid);
          } else {
            // New format - check for user's role (case-insensitive)
            const userEntry = emails.find(e => e.email?.toLowerCase() === currentUserEmail);
            if (userEntry) {
              setUserRole(userEntry.role || 'write');
              // All shared users (both read and write) should use the owner's UID to see shared data
              setOwnerId(ownerUid || auth.currentUser.uid);
            } else {
              // User not in list - default to write for backward compatibility
              setUserRole('write');
              setOwnerId(auth.currentUser.uid);
            }
          }
        } else {
          // Empty list - default to write
          setUserRole('write');
          setOwnerId(auth.currentUser.uid);
        }
      } else {
        // No access document - default to write for backward compatibility
        setUserRole('write');
        setOwnerId(auth.currentUser.uid);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error loading access control:', error);
      // On error, default to write for safety
      setUserRole('write');
      setOwnerId(auth.currentUser.uid);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth.currentUser?.email]);

  const canWrite = userRole === 'write';
  const isReadOnly = userRole === 'read';
  const isOwner = auth.currentUser?.email?.toLowerCase() === OWNER_EMAIL;

  return (
    <AccessContext.Provider value={{
      userRole,
      canWrite,
      isReadOnly,
      isOwner,
      ownerId, // The UID whose data should be viewed
      loading
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
