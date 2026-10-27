import { Fragment } from 'react';

/**
 * Minimal, safe Markdown for Elio's replies: paragraphs, "-"/"1." lists, **bold** and `code`.
 * Everything is rendered as React text nodes (never HTML), so model output cannot inject markup.
 */

const INLINE = /(\*\*[^*\n]+?\*\*|__[^_\n]+?__|`[^`\n]+?`)/g;

function inline(text, keyPrefix) {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (/^\*\*[^*]+\*\*$/.test(part) || /^__[^_]+__$/.test(part)) {
      return (
        <strong key={key} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (/^`[^`]+`$/.test(part)) {
      return (
        <code key={key} className="rounded bg-black/5 dark:bg-white/10 px-1 py-0.5 text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

/** While text is still streaming, hide a bold marker that has not been closed yet (e.g. "**Entra"). */
function hideDanglingMarkers(text) {
  const stars = (text.match(/\*\*/g) ?? []).length;
  if (stars % 2 === 1) {
    const at = text.lastIndexOf('**');
    return text.slice(0, at) + text.slice(at + 2);
  }
  return text;
}

function parseBlocks(text) {
  const blocks = [];
  let para = [];
  let list = null;
  const flushPara = () => {
    if (para.length) blocks.push({ type: 'p', lines: para });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^\s*#{1,4}\s+(.*)$/);
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (bullet || numbered) {
      flushPara();
      const type = bullet ? 'ul' : 'ol';
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((bullet ?? numbered)[1]);
    } else if (heading) {
      flushPara();
      flushList();
      blocks.push({ type: 'h', text: heading[1] });
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

export default function Markdown({ text, streaming = false }) {
  const source = streaming ? hideDanglingMarkers(text) : text;
  const blocks = parseBlocks(source);

  return (
    <div className="space-y-2 break-words">
      {blocks.map((b, i) => {
        if (b.type === 'ul' || b.type === 'ol') {
          const Tag = b.type;
          return (
            <Tag key={i} className={`${b.type === 'ul' ? 'list-disc' : 'list-decimal'} pl-5 space-y-0.5`}>
              {b.items.map((item, j) => (
                <li key={j}>{inline(item, `${i}-${j}`)}</li>
              ))}
            </Tag>
          );
        }
        if (b.type === 'h') {
          return (
            <p key={i} className="font-semibold">
              {inline(b.text, `h${i}`)}
            </p>
          );
        }
        return (
          <p key={i}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l, `${i}-${j}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
