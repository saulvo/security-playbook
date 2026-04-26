'use client';

import { createContext, use, useState, useCallback, useRef, type ReactNode, type RefObject } from 'react';
import type { PostMeta } from '@/lib/blog';

interface SearchState {
  isOpen: boolean;
  query: string;
  filteredPosts: PostMeta[];
}

interface SearchActions {
  setQuery: (q: string) => void;
  open: () => void;
  close: () => void;
}

interface SearchMeta {
  inputRef: RefObject<HTMLInputElement | null>;
}

interface SearchContextValue {
  state: SearchState;
  actions: SearchActions;
  meta: SearchMeta;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function useSearch() {
  const context = use(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within SearchProvider');
  }
  return context;
}

interface SearchProviderProps {
  children: ReactNode;
  allPosts: PostMeta[];
}

export function SearchProvider({ children, allPosts }: SearchProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

  const filteredPosts = query.trim()
    ? allPosts.filter(
        (post) =>
          post.title.toLowerCase().includes(query.toLowerCase()) ||
          post.description.toLowerCase().includes(query.toLowerCase()) ||
          post.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
      )
    : allPosts.slice(0, 10);

  const value: SearchContextValue = {
    state: {
      isOpen,
      query,
      filteredPosts,
    },
    actions: {
      setQuery,
      open,
      close,
    },
    meta: {
      inputRef,
    },
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}