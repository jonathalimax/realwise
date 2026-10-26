import { useEffect, useState } from 'react';
import { chatResource } from '../lib/api/resources/chat';

/**
 * true = the user has no bank account yet, so John (the chat) sets them up; false = already set up; null = still checking.
 * A failed check counts as "set up" so a network hiccup never traps someone away from the dashboard.
 */
export function useNeedsSetup() {
  const [needsSetup, setNeedsSetup] = useState(null);

  useEffect(() => {
    let active = true;
    chatResource
      .onboardingStatus()
      .then((status) => active && setNeedsSetup(Boolean(status?.needsSetup)))
      .catch(() => active && setNeedsSetup(false));
    return () => {
      active = false;
    };
  }, []);

  return needsSetup;
}
