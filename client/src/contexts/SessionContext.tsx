// ============================================================================
// Session Context — Anonymous user identity via localStorage UUID
// ============================================================================

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

const SESSION_KEY = 'ashta_session_token';
const NAME_KEY = 'ashta_display_name';

interface SessionContextValue {
  sessionToken: string;
  displayName: string;
  setDisplayName: (name: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}

function getOrCreateToken(): string {
  let token = localStorage.getItem(SESSION_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, token);
  }
  return token;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionToken] = useState(() => getOrCreateToken());
  const [displayName, setName] = useState(() => localStorage.getItem(NAME_KEY) || '');

  const setDisplayName = (name: string) => {
    setName(name);
    localStorage.setItem(NAME_KEY, name);
  };

  return (
    <SessionContext.Provider value={{ sessionToken, displayName, setDisplayName }}>
      {children}
    </SessionContext.Provider>
  );
}
