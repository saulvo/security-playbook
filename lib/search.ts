import type { PostMeta } from './blog';

export interface SearchResult {
  slug: string;
  category: string;
  title: string;
  description: string;
}

export function searchPosts(posts: PostMeta[], query: string, limit = 10): SearchResult[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  return posts
    .filter(
      (post) =>
        post.title.toLowerCase().includes(lowerQuery) ||
        post.description.toLowerCase().includes(lowerQuery) ||
        post.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    )
    .slice(0, limit)
    .map((post) => ({
      slug: post.slug,
      category: post.category,
      title: post.title,
      description: post.description,
    }));
}