import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { serverRepository } from './ServerRepository';
import type { CurrentUser } from './types';

type InitState = 'loading' | 'ready';

const InitStateContext = createContext<InitState>('loading');

/** Loads persisted session state once at app startup; children see 'loading' until done. */
export function ServerRepositoryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<InitState>('loading');

  useEffect(() => {
    let cancelled = false;
    serverRepository.init().finally(() => {
      if (!cancelled) setState('ready');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <InitStateContext.Provider value={state}>{children}</InitStateContext.Provider>;
}

export function useServerRepositoryReady(): boolean {
  return useContext(InitStateContext) === 'ready';
}

/** Live-updating current server/user, equivalent to collecting ServerRepository.current. */
export function useCurrentUser(): CurrentUser | null {
  return useSyncExternalStore(serverRepository.subscribe, serverRepository.getSnapshot);
}
