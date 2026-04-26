'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { useSearch } from './SearchContext';

export default function SearchModal() {
  const { state, actions } = useSearch();
  const { query, filteredPosts } = state;
  const { setQuery, close } = actions;
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };

    if (state.isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [state.isOpen, close]);

  const handleSelect = (slug: string, category: string) => {
    close();
    router.push(`/${category}/${slug}`);
  };

  if (!state.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={close}
      />
      <div
        className="relative w-full max-w-xl bg-card-bg rounded-xl overflow-hidden"
        style={{
          boxShadow:
            'rgba(0,0,0,0.08) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 2px 2px, rgba(0,0,0,0.04) 0px 8px 8px -8px, #fafafa 0px 0px 0px 1px',
        }}
      >
        <Command className="flex flex-col max-h-[60vh]" shouldFilter={false}>
          <div className="flex items-center border-b border-border dark:border-border px-4">
            <svg
              className="w-5 h-5 text-muted dark:text-muted"
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
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search posts..."
              className="flex-1 px-4 py-4 text-sm bg-transparent outline-none text-foreground dark:text-foreground placeholder:text-muted dark:placeholder:text-muted"
              autoFocus
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs text-muted dark:text-muted bg-surface-hover dark:bg-surface-hover rounded">
              ESC
            </kbd>
          </div>
          <Command.List className="overflow-y-auto p-2">
            {filteredPosts.length === 0 ? (
              <p className="px-4 py-8 text-sm text-center text-muted dark:text-muted">
                No posts found.
              </p>
            ) : (
              filteredPosts.map((post) => (
                <Command.Item
                  key={`${post.category}-${post.slug}`}
                  value={`${post.title} ${post.description}`}
                  onSelect={() => handleSelect(post.slug, post.category)}
                  className="flex flex-col gap-1 px-4 py-3 cursor-pointer rounded-lg hover:bg-surface-hover dark:hover:bg-surface-hover data-[selected=true]:bg-surface-hover dark:data-[selected=true]:bg-surface-hover"
                >
                  <span className="text-sm font-medium text-foreground dark:text-foreground">
                    {post.title}
                  </span>
                  {post.description && (
                    <span className="text-xs text-muted dark:text-muted line-clamp-1">
                      {post.description}
                    </span>
                  )}
                </Command.Item>
              ))
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}