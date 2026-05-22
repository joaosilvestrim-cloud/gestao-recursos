/**
 * Lightweight markdown → HTML renderer (no external dependencies)
 * Supports: headings, bold, italic, code blocks, inline code,
 *           lists (ul/ol), blockquotes, horizontal rules, links, images
 */
export function markdownToHtml(md: string): string {
  if (!md) return '';
  let html = md
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Fenced code blocks ```lang\n...\n```
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="bg-gray-800 border border-white/10 rounded-lg p-4 overflow-x-auto my-4 text-sm font-mono text-green-300"><code>${code.trim()}</code></pre>`;
  });

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-4 border-cyan-500/50 pl-4 italic text-gray-400 my-3">$1</blockquote>');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold text-white mt-6 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-8 mb-3 border-b border-white/10 pb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-8 mb-4">$1</h1>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr class="border-white/10 my-6" />');

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em class="italic text-gray-300">$1</em>');
  html = html.replace(/__(.+?)__/g, '<strong class="font-bold text-white">$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em class="italic text-gray-300">$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-800 text-cyan-300 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');

  // Unordered lists — group consecutive lines
  html = html.replace(/((?:^[-*+] .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(l => `<li class="ml-4 list-disc">${l.replace(/^[-*+] /, '')}</li>`).join('\n');
    return `<ul class="my-3 space-y-1 text-gray-300">${items}</ul>`;
  });

  // Ordered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(l => `<li class="ml-4 list-decimal">${l.replace(/^\d+\. /, '')}</li>`).join('\n');
    return `<ol class="my-3 space-y-1 text-gray-300">${items}</ol>`;
  });

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-cyan-400 underline hover:text-cyan-300" target="_blank" rel="noopener">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded-lg my-4" />');

  // Paragraphs — wrap double-newline separated blocks
  html = html
    .split(/\n{2,}/)
    .map(block => {
      block = block.trim();
      if (!block) return '';
      // Don't wrap already-block elements
      if (/^<(h[1-6]|ul|ol|pre|blockquote|hr)/.test(block)) return block;
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
