<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Dev commands

- `bun run dev` — start dev server at localhost:3000
- `bun run build` — production build
- `bun run lint` — ESLint

No test script, no typecheck script.

## Architecture

- **Content site**: Markdown files in `content/` are rendered as pages via `app/[category]/[slug]/page.tsx` using `next-mdx-remote`. The `content/` directory IS the page source — do not move or restructure it.
- **Key deps**: `gray-matter` (frontmatter parsing), `next-mdx-remote` (MDX rendering), `shiki` + `rehype-pretty-code` (syntax highlighting), `flexsearch` + `cmdk` (search UI).
- **Styling**: Tailwind CSS v4 with `@tailwindcss/postcss`. No `tailwind.config.js` — configuration is likely in `postcss.config.js` or inline. Consult `globals.css` for the actual setup.

## Design system

`DESIGN.md` contains the full Vercel-inspired design spec (colors, typography, shadow system, component patterns). This is the source of truth for styling decisions — do not guess.

## Next.js version

Next.js **16.2.4** with React **19.2.4**. This is significantly newer than most training data. If something seems off, check `node_modules/next/dist/docs/`.

