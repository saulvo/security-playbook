import readingTime from 'reading-time';

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function extractToc(content: string): TocItem[] {
  const headingRegex = /^#{2,3}\s+(.+)$/gm;
  const toc: TocItem[] = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const text = match[1].trim();
      const hashMatch = fullMatch.match(/^#+ /);
    const level = hashMatch ? hashMatch[0].length - 1 : 2;
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    toc.push({ id, text, level });
  }

  return toc;
}

export function extractReadingTime(content: string): string {
  return readingTime(content).text;
}