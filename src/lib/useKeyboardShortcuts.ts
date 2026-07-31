import { useEffect } from 'react';

type KeyHandler = (e: KeyboardEvent) => void;

interface ShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  handler: KeyHandler;
  preventInputFocus?: boolean;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if the user is typing in an input (unless preventInputFocus is false)
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';

      for (const shortcut of shortcuts) {
        if (isInputFocused && shortcut.preventInputFocus !== false) {
          continue;
        }

        const matchKey = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const matchCtrl = !!shortcut.ctrlKey === (e.ctrlKey || e.metaKey);
        const matchShift = !!shortcut.shiftKey === e.shiftKey;

        if (matchKey && matchCtrl && matchShift) {
          e.preventDefault();
          shortcut.handler(e);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
