import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../api/client.js';

// Runs an async loader whenever `deps` change; ignores stale responses (e.g. rapid filter changes).
export default function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const counter = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async (silent = false) => {
    const id = ++counter.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await loaderRef.current();
      if (id === counter.current) setState({ data, loading: false, error: '' });
    } catch (err) {
      if (id === counter.current) setState((s) => ({ ...s, loading: false, error: getErrorMessage(err) }));
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); return () => { counter.current += 1; }; }, deps);

  return { ...state, reload: run, setData: (data) => setState((s) => ({ ...s, data })) };
}
