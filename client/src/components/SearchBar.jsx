import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';

// Debounced so we do not hit the API on every keystroke.
export default function SearchBar({ value = '', onSearch, placeholder = 'Search…', delay = 350 }) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  useEffect(() => {
    if (text === value) return undefined;
    const id = setTimeout(() => onSearch(text.trim()), delay);
    return () => clearTimeout(id);
  }, [text, value, delay, onSearch]);
  return (
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input type="search" className="input pl-9 pr-8" placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} aria-label={placeholder} />
      {text && (
        <button type="button" onClick={() => { setText(''); onSearch(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600" aria-label="Clear search"><X size={14} /></button>
      )}
    </div>
  );
}
