import React, { useState, useEffect, useRef, useLayoutEffect, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';

interface LiveSearchProps {
  placeholder: string;
  onSelect: (item: any) => void;
  data: any[];
  searchFields: string[];
  renderItem: (item: any) => React.ReactNode;
  onChange?: (query: string) => void;
  clearOnSelect?: boolean;
  className?: string;
}

export const LiveSearch = forwardRef<HTMLInputElement, LiveSearchProps>(({ 
  placeholder, 
  onSelect, 
  data, 
  searchFields, 
  renderItem,
  onChange,
  clearOnSelect = false,
  className = ""
}, ref) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length >= 3) {
      const lowerQuery = query.toLowerCase();
      const filtered = data.filter(item => 
        searchFields.some(field => {
          const val = item[field];
          return val && val.toString().toLowerCase().includes(lowerQuery);
        })
      );
      setResults(filtered);
    } else {
      setResults([]);
      setShowDropdown(false);
    }
  }, [query, data, searchFields]);

  const handleInputChange = (val: string) => {
    setQuery(val);
    if (onChange) onChange(val);
    if (val.length >= 3) {
      setShowDropdown(true);
    }
  };

  useLayoutEffect(() => {
    if (showDropdown && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const dropdownHeight = 300; 
      
      let top = rect.bottom + 8;
      if (top + dropdownHeight > viewportHeight - 10) {
        top = rect.top - dropdownHeight - 8;
      }

      setDropdownCoords({
        top,
        left: rect.left,
        width: rect.width
      });
    }
  }, [showDropdown, results]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const isInsideContainer = containerRef.current?.contains(event.target as Node);
      const isInsideDropdown = dropdownRef.current?.contains(event.target as Node);
      
      if (!isInsideContainer && !isInsideDropdown) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: any) => {
    onSelect(item);
    if (clearOnSelect) {
      setQuery('');
    } else {
      const displayVal = item.full_name || item.name || item.item_name || item.username || item.id;
      setQuery(displayVal);
    }
    setShowDropdown(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="leh-search-box">
        <Search size={20} className="leh-search-icon" />
        <input
          ref={ref}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => query.length >= 3 && setShowDropdown(true)}
          spellCheck={false}
        />
        {query && (
          <button onClick={() => setQuery('')} className="leh-search-clear" type="button">
            <X size={16} />
          </button>
        )}
      </div>

      {showDropdown && query.length >= 3 && createPortal(
        <div 
          ref={dropdownRef}
          className="bg-white border border-slate-200 rounded-lg shadow-lg z-[10000] max-h-60 overflow-y-auto"
          style={{
            position: 'fixed',
            top: `${dropdownCoords.top}px`,
            left: `${dropdownCoords.left}px`,
            width: `${dropdownCoords.width}px`,
          }}
        >
          {results.length > 0 ? (
            <div className="py-2">
              {results.map((item, index) => (
                <div 
                  key={item.id || index} 
                  className="px-4 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors"
                  onClick={() => handleSelect(item)}
                >
                  {renderItem(item)}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-slate-500">
              <p className="text-sm font-medium">No results found for "{query}"</p>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
});
