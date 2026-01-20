import React, { createContext, useContext, useState, useCallback } from 'react';
import { flushSync } from 'react-dom';

const LoginModalContext = createContext(undefined);

export function LoginModalProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [triggerSource, setTriggerSource] = useState(null); // 'login-button' or 'start-annotating-button'

  const open = useCallback((source = null) => {
    // Use flushSync for immediate state update to reduce delay
    flushSync(() => {
      setTriggerSource(source);
      setIsOpen(true);
    });
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setTriggerSource(null);
  }, []);

  return (
    <LoginModalContext.Provider value={{ isOpen, open, close, triggerSource }}>
      {children}
    </LoginModalContext.Provider>
  );
}

export function useLoginModal() {
  const context = useContext(LoginModalContext);
  if (!context) {
    throw new Error('useLoginModal must be used within LoginModalProvider');
  }
  return context;
}

