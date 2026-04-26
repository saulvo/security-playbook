'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { useSearch } from './SearchContext';
import type { PostMeta } from '@/lib/blog';

interface SearchModalProps {
  posts: PostMeta[];
}

export default function SearchModal({ posts }: SearchModalProps) {
  const [search, setSearch] = useState('');
  const { isOpen, close } = useSearch();
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, close]);

  const filteredPosts = search.trim()
    ? posts.filter(
        (post) =>
          post.title.toLowerCase().includes(search.toLowerCase()) ||
          post.description.toLowerCase().includes(search.toLowerCase()) ||
          post.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
      )
    : posts.slice(0, 10);

  const handleSelect = (slug: string, category: string) => {
    close();
    setSearch('');
    router.push(`/${category}/${slug}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={close}
      />
      <div
        className="relative w-full max-w-xl bg-white dark:bg-[#1a1a1a] rounded-xl overflow-hidden"
        style={{
          boxShadow:
            'rgba(0,0,0,0.08) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 2px 2px, rgba(0,0,0,0.04) 0px 8px 8px -8px, #fafafa 0px 0px 0px 1px',
        }}
      >
        <Command className="flex flex-col max-h-[60vh]" shouldFilter={false}>
          <div className="flex items-center border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.1)] px-4">
            <svg
              className="w-5 h-5 text-[#666] dark:text-[#888]"
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
              value={search}
              onValueChange={setSearch}
              placeholder="Search posts..."
              className="flex-1 px-4 py-4 text-sm bg-transparent outline-none text-[#171717] dark:text-[#ededed] placeholder:text-[#666] dark:placeholder:text-[#888]"
              autoFocus
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs text-[#666] dark:text-[#888] bg-[#fafafa] dark:bg-[#2a2a2a] rounded">
              ESC
            </kbd>
          </div>
          <Command.List className="overflow-y-auto p-2">
            {filteredPosts.length === 0 ? (
              <p className="px-4 py-8 text-sm text-center text-[#666] dark:text-[#888]">
                No posts found.
              </p>
            ) : (
              filteredPosts.map((post) => (
                <Command.Item
                  key={`${post.category}-${post.slug}`}
                  value={`${post.title} ${post.description}`}
                  onSelect={() => handleSelect(post.slug, post.category)}
                  className="flex flex-col gap-1 px-4 py-3 cursor-pointer rounded-lg hover:bg-[#fafafa] dark:hover:bg-[#2a2a2a] data-[selected=true]:bg-[#fafafa] dark:data-[selected=true]:bg-[#2a2a2a]"
                >
                  <span className="text-sm font-medium text-[#171717] dark:text-[#ededed]">
                    {post.title}
                  </span>
                  {post.description && (
                    <span className="text-xs text-[#666] dark:text-[#888] line-clamp-1">
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