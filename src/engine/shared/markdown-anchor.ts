/**
 * Shared markdown heading anchor utilities used by both the Vite plan endpoint
 * (server-side section extraction) and PlanView (client-side render so anchor
 * ids stay in sync between the section list and the rendered headings).
 *
 * Slug rules approximate github-slugger: lowercase, replace runs of
 * non-alphanumerics with `-`, strip leading/trailing dashes, dedupe by
 * appending `-2`, `-3`, ...
 */

export interface MarkdownSection {
  slug: string;
  title: string;
  level: number;
  /** 1-based line number in the original markdown source. */
  line: number;
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u3000\s]+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function extractSections(markdown: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  const seen = new Map<string, number>();
  let inFence = false;
  const lines = markdown.split(/\r?\n/);

  lines.forEach((line, idx) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    const match = HEADING_RE.exec(line);
    if (!match) return;

    const level = match[1].length;
    const title = match[2].trim();
    if (!title) return;

    const baseSlug = slugify(title) || `section-${idx + 1}`;
    const count = seen.get(baseSlug) ?? 0;
    const slug = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
    seen.set(baseSlug, count + 1);

    sections.push({ slug, title, level, line: idx + 1 });
  });

  return sections;
}
