import { useCallback, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { testCacadorAI } from '@/lib/cacador-ai.functions';
import { initialConnection, failedConnection, type CacadorConnection } from '@/lib/cacador-connection';
export function useCacadorConnection() {
  const test = useServerFn(testCacadorAI);
  const [connection, setConnection] = useState<CacadorConnection>(initialConnection);
  const [checking, setChecking] = useState(false);
  const check = useCallback(async () => {
    setChecking(true);
    setConnection(initialConnection);
    try { setConnection(await test()); }
    catch { setConnection(failedConnection('unavailable')); }
    finally { setChecking(false); }
  }, [test]);
  return { connection, setConnection, checking, check };
}
