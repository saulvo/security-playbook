import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import readingTime from 'reading-time';

const contentDir = './content';

export interface PostMeta {
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  readingTime: string;
  order: number;
  slug: string;
  category: string;
}

export interface Post extends PostMeta {
  content: string;
}

export interface CategoryInfo {
  slug: string;
  name: string;
  order: number;
}

const categoryOrder: Record<string, number> = {
  '01-authentication': 1,
  '02-authorization': 2,
  '03-encryption': 3,
  '04-web-chat-security': 4,
  '05-xss-csrf-csp': 5,
  '06-security-scanning': 6,
  '07-checklists': 7,
};

const categoryNames: Record<string, string> = {
  'authentication': 'Authentication',
  'authorization': 'Authorization',
  'encryption': 'Encryption',
  'web-chat-security': 'Web Chat Security',
  'xss-csrf-csp': 'XSS, CSRF & CSP',
  'security-scanning': 'Security Scanning',
  'checklists': 'Checklists',
};

function getCategoryFromDir(dirName: string): string {
  return dirName.replace(/^\d+-/, '');
}

export function getAllCategories(): CategoryInfo[] {
  const dirs = fs.readdirSync(contentDir)
    .filter(d => d.startsWith('0'))
    .sort();

  return dirs.map(dir => {
    const categorySlug = getCategoryFromDir(dir);
    return {
      slug: categorySlug,
      name: categoryNames[categorySlug] || categorySlug,
      order: categoryOrder[dir] || 99,
    };
  }).sort((a, b) => a.order - b.order);
}

export function getPostsByCategory(categorySlug: string): PostMeta[] {
  const dirs = fs.readdirSync(contentDir)
    .filter(d => d.startsWith('0'));

  const categoryDir = dirs.find(d => getCategoryFromDir(d) === categorySlug);

  if (!categoryDir) return [];

  const dirPath = path.join(contentDir, categoryDir);
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));

  return files.map(file => {
    const filePath = path.join(dirPath, file);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(fileContent);
    const rt = readingTime(content);

    return {
      title: data.title || '',
      description: data.description || '',
      date: data.date || new Date().toISOString().split('T')[0],
      author: data.author || 'Saul Vo',
      tags: data.tags || [],
      readingTime: rt.text,
      order: data.order || 0,
      slug: data.slug || file.replace('.md', ''),
      category: data.category || categorySlug,
    };
  }).sort((a, b) => a.order - b.order);
}

export function getAllPosts(): PostMeta[] {
  const categories = getAllCategories();
  const allPosts: PostMeta[] = [];

  for (const cat of categories) {
    const posts = getPostsByCategory(cat.slug);
    allPosts.push(...posts);
  }

  return allPosts;
}

export function getPostBySlug(categorySlug: string, slug: string): Post | null {
  const dirs = fs.readdirSync(contentDir)
    .filter(d => d.startsWith('0'));

  const categoryDir = dirs.find(d => getCategoryFromDir(d) === categorySlug);

  if (!categoryDir) return null;

  const dirPath = path.join(contentDir, categoryDir);
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));

  const file = files.find(f => {
    const filePath = path.join(dirPath, f);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(fileContent);
    return data.slug === slug;
  });

  if (!file) return null;

  const filePath = path.join(dirPath, file);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContent);
  const rt = readingTime(content);

  return {
    title: data.title || '',
    description: data.description || '',
    date: data.date || new Date().toISOString().split('T')[0],
    author: data.author || 'Saul Vo',
    tags: data.tags || [],
    readingTime: rt.text,
    order: data.order || 0,
    slug: data.slug || slug,
    category: data.category || categorySlug,
    content,
  };
}

export function getAdjacentPosts(categorySlug: string, slug: string): { prev: PostMeta | null; next: PostMeta | null } {
  const posts = getPostsByCategory(categorySlug);
  const currentIndex = posts.findIndex(p => p.slug === slug);

  return {
    prev: currentIndex > 0 ? posts[currentIndex - 1] : null,
    next: currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null,
  };
}
