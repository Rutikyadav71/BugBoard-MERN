import { useEffect, useState } from 'react';

// True when the viewport matches the media query. Where matchMedia does not exist (e.g. jsdom in unit
// tests) it returns `fallback`, so callers can choose which layout is the sensible default.
export default function useMediaQuery(query, fallback = false) {
  const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const [matches, setMatches] = useState(() => (supported ? window.matchMedia(query).matches : fallback));

  useEffect(() => {
    if (!supported) return undefined;
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query, supported]);

  return matches;
}
