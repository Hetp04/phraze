import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const FamilyDrawerContext = createContext(undefined);

export function useFamilyDrawer() {
  const ctx = useContext(FamilyDrawerContext);
  if (!ctx) {
    throw new Error('useFamilyDrawer must be used within FamilyDrawerRoot');
  }
  return ctx;
}

export function FamilyDrawerRoot({
  children,
  views = {},
  defaultView = 'default',
  open: controlledOpen,
  onOpenChange,
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [view, setView] = useState(defaultView);

  const isControlled = typeof controlledOpen === 'boolean';
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = useCallback(
    (next) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const close = useCallback(() => setOpen(false), [setOpen]);
  const openDrawer = useCallback(() => setOpen(true), [setOpen]);

  useEffect(() => {
    if (open) setView(defaultView);
  }, [open, defaultView]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && open) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      openDrawer,
      close,
      view,
      setView,
      views,
      defaultView,
    }),
    [open, setOpen, openDrawer, close, view, views, defaultView]
  );

  return <FamilyDrawerContext.Provider value={value}>{children}</FamilyDrawerContext.Provider>;
}

export function FamilyDrawerTrigger({ children }) {
  const { openDrawer } = useFamilyDrawer();
  return (
    <div onClick={openDrawer} style={{ display: 'inline-flex' }}>
      {children}
    </div>
  );
}

export function FamilyDrawerContent({
  children,
  scope = 'viewport',
  zIndexBase = 9998,
  maxHeight = '70vh',
  showBackdrop = true,
  captureOutsideClicks = false,
}) {
  const { open, close } = useFamilyDrawer();

  const isParent = scope === 'parent';
  const backdropZ = zIndexBase;
  const drawerZ = zIndexBase + 1;

  return (
    <AnimatePresence>
      {open && (
        <>
          {showBackdrop && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onMouseDown={close}
              style={{
                position: isParent ? 'absolute' : 'fixed',
                inset: 0,
                backgroundColor: 'rgba(17, 24, 39, 0.35)',
                zIndex: backdropZ,
              }}
            />
          )}

          {!showBackdrop && captureOutsideClicks && (
            <div
              onMouseDown={close}
              style={{
                position: isParent ? 'absolute' : 'fixed',
                inset: 0,
                backgroundColor: 'transparent',
                zIndex: backdropZ,
              }}
            />
          )}

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            style={{
              position: isParent ? 'absolute' : 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: drawerZ,
              backgroundColor: '#ffffff',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              boxShadow: 'none',
              borderTop: '1px solid #e5e7eb',
              maxHeight,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: '40px',
                height: '4px',
                borderRadius: '9999px',
                backgroundColor: '#e5e7eb',
                margin: '10px auto 6px auto',
                flexShrink: 0,
              }}
            />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function FamilyDrawerAnimatedWrapper({ children }) {
  return <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>;
}

export function FamilyDrawerAnimatedContent({ children }) {
  return <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>;
}

export function FamilyDrawerViewContent() {
  const { view, views } = useFamilyDrawer();
  const View = views?.[view];
  if (!View) return null;
  return <View />;
}
