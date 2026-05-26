import { useState, useEffect } from 'react';

/**
 * Delays updating the returned value until `delay` ms have passed
 * since the last change to `value`. Use this to debounce search inputs
 * so API calls only fire after the user stops typing.
 *
 * Usage:
 *   const debouncedSearch = useDebounce(searchQuery, 300);
 *   useEffect(() => { fetchResults(debouncedSearch); }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
