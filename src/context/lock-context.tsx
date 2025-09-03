
"use client";

import * as React from "react";

type LockContextType = {
  isLocked: boolean;
  lock: () => void;
  unlock: () => void;
};

const LockContext = React.createContext<LockContextType | undefined>(undefined);

const LOCK_STATE_KEY = "alsalam_qgenius_lock_state";

export function LockProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = React.useState(true);

  React.useEffect(() => {
    // On initial load, check sessionStorage for the lock state
    try {
      const storedState = sessionStorage.getItem(LOCK_STATE_KEY);
      if (storedState) {
        setIsLocked(JSON.parse(storedState));
      }
    } catch (error) {
      console.error("Could not read lock state from sessionStorage", error);
    }
  }, []);

  const updateLockState = (locked: boolean) => {
    try {
      sessionStorage.setItem(LOCK_STATE_KEY, JSON.stringify(locked));
      setIsLocked(locked);
    } catch (error) {
      console.error("Could not save lock state to sessionStorage", error);
      // Fallback to local state if storage fails
      setIsLocked(locked);
    }
  };

  const lock = () => updateLockState(true);
  const unlock = () => updateLockState(false);

  const value = { isLocked, lock, unlock };

  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}

export function useLock() {
  const context = React.useContext(LockContext);
  if (context === undefined) {
    throw new Error("useLock must be used within a LockProvider");
  }
  return context;
}
