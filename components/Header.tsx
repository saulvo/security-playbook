'use client';

import ThemeToggle from './ThemeToggle';
import { useSearch } from './SearchContext';

export default function Header() {
  const { open: openSearch } = useSearch();

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-[#0a0a0a] border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.1)]">
      <nav className="max-w-5xl mx-auto w-full px-6 h-16 flex items-center justify-between">
        <a
          href="/"
          className="text-lg font-semibold tracking-tight text-[#171717] dark:text-[#ededed]"
        >
          Security Playbook
        </a>

        <div className="flex items-center gap-6">
          <button
            onClick={openSearch}
            className="flex items-center gap-2 text-sm text-[#666] dark:text-[#888] hover:text-[#171717] dark:hover:text-[#ededed] transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-[#fafafa] dark:bg-[#2a2a2a] rounded">
              ⌘K
            </kbd>
          </button>

          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}