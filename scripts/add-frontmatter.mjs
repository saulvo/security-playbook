import fs from 'fs';
import path from 'path';

const contentDir = './content';

const categoryMap = {
  '01-authentication': { slug: 'authentication', tags: ['authentication', 'security', 'oauth', 'jwt'] },
  '02-authorization': { slug: 'authorization', tags: ['authorization', 'rbac', 'permissions'] },
  '03-encryption': { slug: 'encryption', tags: ['encryption', 'cryptography', 'e2ee'] },
  '04-web-chat-security': { slug: 'web-chat-security', tags: ['chat', 'websocket', 'realtime', 'security'] },
  '05-xss-csrf-csp': { slug: 'xss-csrf-csp', tags: ['xss', 'csrf', 'csp', 'security'] },
  '06-security-scanning': { slug: 'security-scanning', tags: ['security', 'scanning', 'testing', 'vulnerability'] },
  '07-checklists': { slug: 'checklists', tags: ['checklist', 'security', 'best-practices'] },
};

const author = 'Saul Vo';
const buildDate = new Date().toISOString().split('T')[0];

function getFiles(dir) {
  return fs.readdirSync(dir).filter(f => f.endsWith('.md'));
}

function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateFrontmatter(title, categoryDir, fileName, order) {
  const categoryInfo = categoryMap[categoryDir];
  const fileSlug = fileName.replace('.md', '');

  return `---
title: "${title}"
description: ""
date: "${buildDate}"
author: "${author}"
tags: ${JSON.stringify(categoryInfo?.tags || [])}
readingTime: "5 min"
order: ${order}
slug: "${fileSlug}"
category: "${categoryInfo?.slug || ''}"
---

`;
}

function processFile(filePath, categoryDir, order) {
  let content = fs.readFileSync(filePath, 'utf-8');

  // Remove existing frontmatter if any
  if (content.startsWith('---')) {
    const frontmatterEnd = content.indexOf('---', 3);
    if (frontmatterEnd !== -1) {
      content = content.slice(frontmatterEnd + 3);
    }
  }

  const title = extractTitle(content);
  const frontmatter = generateFrontmatter(title, categoryDir, path.basename(filePath), order);
  const newContent = frontmatter + content;

  fs.writeFileSync(filePath, newContent);
  console.log(`Added frontmatter to: ${filePath}`);
}

function main() {
  const dirs = fs.readdirSync(contentDir).filter(d => d.startsWith('0'));

  for (const dir of dirs) {
    const dirPath = path.join(contentDir, dir);
    const files = getFiles(dirPath);

    files.forEach((file, index) => {
      const filePath = path.join(dirPath, file);
      processFile(filePath, dir, index + 1);
    });
  }
}

main();
