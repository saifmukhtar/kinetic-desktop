import { createContext, useContext, useState, ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────
// BinaryStatusContext
//
// Holds the result of check_binary_status(), which is called
// ONCE at app startup inside App.tsx's checkSystemState().
// The Dashboard reads from this context — no polling, no
// re-fetching, no CPU burn.
// ─────────────────────────────────────────────────────────────

export interface BinaryStatus {
  kin:        boolean;
  kin_daemon: boolean;
  kin_pac:    boolean;
}

interface BinaryStatusContextValue {
  status:    BinaryStatus | null;
  setStatus: (s: BinaryStatus) => void;
}

const BinaryStatusContext = createContext<BinaryStatusContextValue>({
  status:    null,
  setStatus: () => {},
});

export function BinaryStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<BinaryStatus | null>(null);
  return (
    <BinaryStatusContext.Provider value={{ status, setStatus }}>
      {children}
    </BinaryStatusContext.Provider>
  );
}

export function useBinaryStatus() {
  return useContext(BinaryStatusContext);
}
