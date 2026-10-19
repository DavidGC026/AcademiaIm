import { Fragment, type ReactNode } from 'react';
import { parseChatMarkdown } from '@/lib/chat-markdown';

const inlinePattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;

function renderInlineMarkdown(content: string): ReactNode[] {
  return content.split(inlinePattern).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export default function ChatMarkdown({ content }: { content: string }) {
  const blocks = parseChatMarkdown(content);

  return (
    <div className="chat-markdown">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const Heading = `h${block.level + 2}` as 'h3' | 'h4' | 'h5';
          return <Heading key={index}>{renderInlineMarkdown(block.content)}</Heading>;
        }
        if (block.type === 'ordered-list') {
          return (
            <ol key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ol>
          );
        }
        if (block.type === 'unordered-list') {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === 'quote') {
          return <blockquote key={index}>{renderInlineMarkdown(block.content)}</blockquote>;
        }
        return <p key={index}>{renderInlineMarkdown(block.content)}</p>;
      })}
    </div>
  );
}
