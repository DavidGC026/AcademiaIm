export type ChatMarkdownBlock =
  | { type: 'paragraph'; content: string }
  | { type: 'heading'; content: string; level: 1 | 2 | 3 }
  | { type: 'ordered-list'; items: string[] }
  | { type: 'unordered-list'; items: string[] }
  | { type: 'quote'; content: string };

const orderedItemPattern = /^\s*\d+\.\s+(.+)$/;
const unorderedItemPattern = /^\s*[-*]\s+(.+)$/;
const headingPattern = /^(#{1,3})\s+(.+)$/;
const quotePattern = /^>\s?(.+)$/;

function startsNewBlock(line: string): boolean {
  return orderedItemPattern.test(line)
    || unorderedItemPattern.test(line)
    || headingPattern.test(line)
    || quotePattern.test(line);
}

export function parseChatMarkdown(markdown: string): ChatMarkdownBlock[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ChatMarkdownBlock[] = [];

  for (let lineIndex = 0; lineIndex < lines.length;) {
    const currentLine = lines[lineIndex].trimEnd();
    if (!currentLine.trim()) {
      lineIndex += 1;
      continue;
    }

    const heading = currentLine.match(headingPattern);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        content: heading[2].trim(),
      });
      lineIndex += 1;
      continue;
    }

    const quote = currentLine.match(quotePattern);
    if (quote) {
      blocks.push({ type: 'quote', content: quote[1].trim() });
      lineIndex += 1;
      continue;
    }

    const orderedItem = currentLine.match(orderedItemPattern);
    if (orderedItem) {
      const items: string[] = [];
      while (lineIndex < lines.length) {
        const match = lines[lineIndex].match(orderedItemPattern);
        if (!match) break;
        items.push(match[1].trim());
        lineIndex += 1;
      }
      blocks.push({ type: 'ordered-list', items });
      continue;
    }

    const unorderedItem = currentLine.match(unorderedItemPattern);
    if (unorderedItem) {
      const items: string[] = [];
      while (lineIndex < lines.length) {
        const match = lines[lineIndex].match(unorderedItemPattern);
        if (!match) break;
        items.push(match[1].trim());
        lineIndex += 1;
      }
      blocks.push({ type: 'unordered-list', items });
      continue;
    }

    const paragraphLines = [currentLine.trim()];
    lineIndex += 1;
    while (
      lineIndex < lines.length
      && lines[lineIndex].trim()
      && !startsNewBlock(lines[lineIndex])
    ) {
      paragraphLines.push(lines[lineIndex].trim());
      lineIndex += 1;
    }
    blocks.push({ type: 'paragraph', content: paragraphLines.join(' ') });
  }

  return blocks;
}
