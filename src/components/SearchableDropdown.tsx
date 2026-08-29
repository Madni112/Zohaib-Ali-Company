import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MdSearch } from 'react-icons/md';

interface SearchableDropdownProps {
  label?: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  className?: string;
  allLabel?: string;
}

export const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder,
  className = '',
  allLabel
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o => String(o || '').toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, isOpen]);

  const defaultAllText = allLabel || `All ${placeholder}s`;

  // Total items in list: 0 is default "All", 1..n are filtered options
  const totalCount = filtered.length + 1;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % totalCount);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + totalCount) % totalCount);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex === 0) {
        onChange('All');
      } else {
        const selectedOpt = filtered[highlightedIndex - 1];
        if (selectedOpt) onChange(selectedOpt);
      }
      setIsOpen(false);
      setQuery('');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  return (
    <div className={`relative ${className}`} ref={containerRef} onKeyDown={handleKeyDown}>
      {label && <label className="block font-bold text-gray-500 dark:text-slate-400 text-[11px] mb-1">{label}</label>}
      <div
        onClick={() => setIsOpen(!isOpen)}
        tabIndex={0}
        className="w-full rounded-lg border border-stroke dark:border-strokedark bg-transparent p-2 font-semibold text-xs text-black dark:text-white cursor-pointer flex justify-between items-center transition hover:border-primary select-none min-h-[34px] outline-none focus:border-primary"
      >
        <span className="truncate">{value === 'All' ? `${defaultAllText} (${options.length})` : value}</span>
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-[999999] w-full min-w-[220px] bg-white dark:bg-[#1A222C] border border-stroke dark:border-strokedark rounded-xl shadow-2xl p-2 space-y-1">
          <div className="relative mb-1">
            <MdSearch size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Type to search ${placeholder}...`}
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-stroke dark:border-strokedark bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none text-black dark:text-white"
            />
          </div>

          <div ref={listRef} className="max-h-48 overflow-y-auto divide-y divide-stroke dark:divide-strokedark">
            <div
              onClick={() => { onChange('All'); setIsOpen(false); setQuery(''); }}
              className={`p-2 rounded-lg cursor-pointer text-xs flex justify-between items-center transition ${
                highlightedIndex === 0 || value === 'All'
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-black dark:text-white'
              }`}
            >
              <span>{defaultAllText}</span>
              <span className="text-[10px] text-gray-400 font-mono">({options.length})</span>
            </div>

            {filtered.length > 0 ? (
              filtered.map((opt, idx) => {
                const isHighlighted = highlightedIndex === idx + 1;
                const isSelected = value === opt;
                return (
                  <div
                    key={opt}
                    onClick={() => { onChange(opt); setIsOpen(false); setQuery(''); }}
                    className={`p-2 rounded-lg cursor-pointer text-xs transition truncate ${
                      isHighlighted || isSelected
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-black dark:text-white'
                    }`}
                    title={opt}
                  >
                    {opt}
                  </div>
                );
              })
            ) : (
              <div className="p-3 text-center text-[11px] text-gray-400 italic">No matching {placeholder.toLowerCase()}s</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;
