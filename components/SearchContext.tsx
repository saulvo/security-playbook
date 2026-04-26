'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface SearchContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const SearchContext = createContext<SearchContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

export function useSearch() {
  return useContext(SearchContext);
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <SearchContext.Provider value={{ isOpen, open, close }}>
      {children}
    </SearchContext.Provider>
  );
}