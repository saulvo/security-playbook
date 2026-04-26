'use client';

import { createContext, use, useState, useCallback, type ReactNode } from 'react';
import type { PostMeta, CategoryInfo } from '@/lib/blog';

const INITIAL_COUNT = 10;
const LOAD_MORE_COUNT = 10;

interface PostListState {
  visibleCount: number;
  selectedCategory: string;
  filteredPosts: PostMeta[];
  hasMore: boolean;
}

interface PostListActions {
  loadMore: () => void;
  setCategory: (category: string) => void;
}

interface PostListContextValue {
  state: PostListState;
  actions: PostListActions;
}

const PostListContext = createContext<PostListContextValue | null>(null);

function usePostListContext() {
  const context = use(PostListContext);
  if (!context) {
    throw new Error('usePostListContext must be used within PostListProvider');
  }
  return context;
}

interface PostListProviderProps {
  children: ReactNode;
  allPosts: PostMeta[];
  initialCategory?: string;
}

export function PostListProvider({ children, allPosts, initialCategory = 'all' }: PostListProviderProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);

  const filteredPosts =
    selectedCategory === 'all'
      ? allPosts
      : allPosts.filter((post) => post.category === selectedCategory);

  const hasMore = visibleCount < filteredPosts.length;
  const visiblePosts = filteredPosts.slice(0, visibleCount);

  const loadMore = useCallback(() => {
    setVisibleCount((c) => c + LOAD_MORE_COUNT);
  }, []);

  const setCategory = useCallback((category: string) => {
    setSelectedCategory(category);
    setVisibleCount(INITIAL_COUNT);
  }, []);

  const value: PostListContextValue = {
    state: {
      visibleCount,
      selectedCategory,
      filteredPosts: visiblePosts,
      hasMore,
    },
    actions: {
      loadMore,
      setCategory,
    },
  };

  return (
    <PostListContext.Provider value={value}>
      {children}
    </PostListContext.Provider>
  );
}

function FilterNav({ categories }: { categories: CategoryInfo[] }) {
  const { state, actions } = usePostListContext();
  const { selectedCategory } = state;
  const { setCategory } = actions;

  return (
    <nav className="flex flex-wrap gap-6 mb-8 border-b border-border pb-4">
      <button
        onClick={() => setCategory('all')}
        className={`text-sm font-medium transition-colors ${
          selectedCategory === 'all'
            ? 'text-foreground'
            : 'text-muted hover:text-foreground'
        }`}
      >
        All Posts
      </button>
      {categories.map((cat) => (
        <button
          key={cat.slug}
          onClick={() => setCategory(cat.slug)}
          className={`text-sm font-medium transition-colors ${
            selectedCategory === cat.slug
              ? 'text-foreground dark:text-foreground'
              : 'text-muted dark:text-muted hover:text-foreground dark:hover:text-foreground'
          }`}
        >
          {cat.name}
        </button>
      ))}
    </nav>
  );
}

function PostGrid() {
  const { state } = usePostListContext();
  const { filteredPosts } = state;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
      {filteredPosts.map((post) => (
        <article
          key={`${post.category}-${post.slug}`}
          className="p-6 bg-card-bg rounded-lg border border-card-border transition-all duration-200 hover:bg-card-hover-overlay dark:hover:bg-card-hover-overlay"
        >
          <a href={`/${post.category}/${post.slug}`} className="block">
            <div className="flex items-start justify-between gap-4 mb-3">
              <h2 className="text-xl font-semibold text-foreground tracking-tight">
                {post.title}
              </h2>
              <span className="text-xs font-medium text-badge-text bg-badge-bg px-2 py-1 rounded-full">
                {post.category}
              </span>
            </div>
            {post.description && (
              <p className="text-muted text-sm mb-4 line-clamp-2">
                {post.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-xs text-muted">
              <span>{post.readingTime}</span>
              <span>•</span>
              <span>{post.author}</span>
            </div>
          </a>
        </article>
      ))}
    </div>
  );
}

function LoadMore() {
  const { state, actions } = usePostListContext();
  const { hasMore } = state;
  const { loadMore } = actions;

  if (!hasMore) return null;

  return (
    <div className="mt-12 text-center">
      <button
        onClick={loadMore}
        className="px-6 py-3 text-sm font-medium bg-foreground text-background rounded-full hover:opacity-90 transition-opacity"
      >
        Load More
      </button>
    </div>
  );
}

function EmptyState() {
  const { state } = usePostListContext();
  const { filteredPosts } = state;

  if (filteredPosts.length > 0) return null;

  return (
    <div className="py-12 text-center">
      <p className="text-sm text-muted">No posts found.</p>
    </div>
  );
}

export const PostList = {
  Provider: PostListProvider,
  FilterNav,
  Grid: PostGrid,
  LoadMore,
  Empty: EmptyState,
};