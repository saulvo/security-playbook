'use client';

import { useState, useEffect } from 'react';
import type { TocItem } from '@/lib/toc';

interface TableOfContentsProps {
  items: TocItem[];
}

export default function TableOfContents({ items }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-80px 0px -80px 0px' }
    );

    items.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-4">
        On this page
      </h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            style={{ paddingLeft: item.level === 3 ? '12px' : '0' }}
          >
            <a
              href={`#${item.id}`}
              className={`block text-sm transition-colors ${
                activeId === item.id
                  ? 'text-link font-medium'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}