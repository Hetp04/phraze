import React, { createContext, useContext, useState, useEffect } from "react";
import { auth } from '../firebase-init';
import { onAuthStateChanged } from 'firebase/auth';

const ExtensionContext = createContext();

export function ExtensionProvider({ children }) {
  const [isInsideExtension, setIsInsideExtension] = useState(false);

  // Reset isInsideExtension when auth state changes (user logs out or switches accounts)
  useEffect(() => {
    let previousUserEmail = null;
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // User logged out - reset extension state
        setIsInsideExtension(false);
        previousUserEmail = null;
      } else {
        // User signed in - check if it's a different user
        const currentUserEmail = user.email;
        if (previousUserEmail && previousUserEmail !== currentUserEmail) {
          // Different user signed in - reset extension state
          setIsInsideExtension(false);
        }
        previousUserEmail = currentUserEmail;
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <ExtensionContext.Provider value={{ isInsideExtension, setIsInsideExtension }}>
      {children}
    </ExtensionContext.Provider>
  );
}

export function useExtension() {
  return useContext(ExtensionContext);
}