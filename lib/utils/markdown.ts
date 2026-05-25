/**
 * Lightweight markdown → HTML renderer (no external dependencies)
 */

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

export interface TocEntry {
  level: 1 | 2 | 3;
  text: string;
  id: string;
}

export function extractToc(md: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const lines = md.split('\n');
  for (const line of lines) {
    const m3 = line.match(/^### (.+)$/);
    const m2 = line.match(/^## (.+)$/);
    const m1 = line.match(/^# (.+)$/);
    if (m3) entries.push({ level: 3, text: m3[1], id: slugify(m3[1]) });
    else if (m2) entries.push({ level: 2, text: m2[1], id: slugify(m2[1]) });
    else if (m1) entries.push({ level: 1, text: m1[1], id: slugify(m1[1]) });
  }
  return entries;
}

export function markdownToHtml(md: string): string {
  if (!md) return '';
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Fenced code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const langLabel = lang ? `<span class="text-[10px] text-gray-600 float-right -mt-1">${lang}</span>` : '';
    return `<pre class="bg-gray-800 border border-white/10 rounded-lg p-4 overflow-x-auto my-4 text-sm font-mono text-green-300 relative">${langLabel}<code>${code.trim()}</code></pre>`;
  });

  // YouTube embed: ![youtube](https://youtube.com/watch?v=ID) or youtu.be/ID
  html = html.replace(/!\[youtube\]\(https?:\/\/(?:www\.youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)[^)]*\)/g,
    (_, id) => `<div class="my-4 aspect-video rounded-xl overflow-hidden"><iframe src="https://www.youtube.com/embed/${id}" class="w-full h-full" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
  );

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded-lg my-4 border border-white/10" />');

  // Tables
  html = html.replace(/((?:^\|.+\|\n?)+)/gm, (block) => {
    const rows = block.trim().split('\n').filter(r => !/^\|[-:| ]+\|$/.test(r));
    if (rows.length === 0) return block;
    const [header, ...body] = rows;
    const thCells = header.split('|').filter(c => c.trim()).map(c => `<th class="px-3 py-2 text-left text-xs font-semibold text-gray-400 border-b border-white/10">${c.trim()}</th>`).join('');
    const bodyRows = body.map(r => {
      const cells = r.split('|').filter(c => c.trim()).map(c => `<td class="px-3 py-2 text-sm text-gray-300 border-b border-white/5">${c.trim()}</td>`).join('');
      return `<tr class="hover:bg-white/2">${cells}</tr>`;
    }).join('');
    return `<div class="overflow-x-auto my-4"><table class="w-full bg-gray-900 border border-white/10 rounded-lg overflow-hidden"><thead><tr>${thCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
  });

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-4 border-cyan-500/50 pl-4 italic text-gray-400 my-3 bg-white/2 py-2 rounded-r-lg">$1</blockquote>');

  // Headings — with anchor IDs for TOC
  html = html.replace(/^### (.+)$/gm, (_, t) => `<h3 id="${slugify(t)}" class="text-lg font-bold text-white mt-6 mb-2 scroll-mt-20">${t}</h3>`);
  html = html.replace(/^## (.+)$/gm, (_, t) => `<h2 id="${slugify(t)}" class="text-xl font-bold text-white mt-8 mb-3 border-b border-white/10 pb-2 scroll-mt-20">${t}</h2>`);
  html = html.replace(/^# (.+)$/gm, (_, t) => `<h1 id="${slugify(t)}" class="text-2xl font-bold text-white mt-8 mb-4 scroll-mt-20">${t}</h1>`);

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr class="border-white/10 my-6" />');

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em class="italic text-gray-300">$1</em>');
  html = html.replace(/__(.+?)__/g, '<strong class="font-bold text-white">$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em class="italic text-gray-300">$1</em>');

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del class="text-gray-600 line-through">$1</del>');

  // Highlight
  html = html.replace(/==(.+?)==/g, '<mark class="bg-yellow-500/20 text-yellow-300 px-1 rounded">$1</mark>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-800 text-cyan-300 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');

  // Unordered lists
  html = html.replace(/((?:^[-*+] .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(l => `<li class="ml-4 list-disc">${l.replace(/^[-*+] /, '')}</li>`).join('\n');
    return `<ul class="my-3 space-y-1 text-gray-300">${items}</ul>`;
  });

  // Ordered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(l => `<li class="ml-4 list-decimal">${l.replace(/^\d+\. /, '')}</li>`).join('\n');
    return `<ol class="my-3 space-y-1 text-gray-300">${items}</ol>`;
  });

  // Checkboxes
  html = html.replace(/^- \[x\] (.+)$/gm, '<label class="flex items-center gap-2 text-gray-400 line-through"><input type="checkbox" checked disabled class="accent-cyan-500" /> $1</label>');
  html = html.replace(/^- \[ \] (.+)$/gm, '<label class="flex items-center gap-2 text-gray-300"><input type="checkbox" disabled class="accent-cyan-500" /> $1</label>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-cyan-400 underline hover:text-cyan-300 transition-colors" target="_blank" rel="noopener">$1</a>');

  // Paragraphs
  html = html
    .split(/\n{2,}/)
    .map(block => {
      block = block.trim();
      if (!block) return '';
      if (/^<(h[1-6]|ul|ol|pre|blockquote|hr|div|table|label)/.test(block)) return block;
      return `<p class="text-gray-300 leading-relaxed my-3">${block.replace(/\n/g, '<br />')}</p>`;
    })
    .join('\n');

  return html;
}

export function plainTextPreview(md: string, maxLength = 160): string {
  return md
    .replace(/#{1,6} /g, '')
    .replace(/\*\*|__|_|\*/g, '')
    .replace(/`{1,3}[\s\S]*?`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function readingTime(md: string): number {
  const words = plainTextPreview(md, 999999).split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

/** Simple fuzzy: all chars of query appear in order in text */
export function fuzzyMatch(text: string, query: string): boolean {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t.includes(q)) return true;
  let ti = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q[qi], ti);
    if (idx === -1) return false;
    ti = idx + 1;
  }
  return true;
}
