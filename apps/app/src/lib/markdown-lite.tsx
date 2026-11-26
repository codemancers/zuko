import type { ReactNode } from 'react';

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Inline markdown: `code`, **bold**, [text](https://link), bare https links and @mentions of the
 * given names. Everything else is plain text, so nothing a comment says is ever markup or a script.
 */
function inline(text: string, mentions: string[], key: string): ReactNode[] {
  const names = [...mentions].sort((a, b) => b.length - a.length).map(escape);
  const token = new RegExp(
    [
      '`[^`\\n]+`',
      '\\*\\*[^*\\n]+\\*\\*',
      '\\[[^\\]\\n]+\\]\\(https?://[^\\s)]+\\)',
      'https?://[^\\s<]+',
      ...(names.length ? [`@(?:${names.join('|')})(?![\\p{L}\\p{N}_])`] : []),
    ].join('|'),
    'gu',
  );
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(token)) {
    const [raw] = match;
    const at = match.index;
    if (at > last) out.push(text.slice(last, at));
    const k = `${key}-${at}`;
    if (raw.startsWith('`')) {
      out.push(
        <code key={k} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {raw.slice(1, -1)}
        </code>,
      );
    } else if (raw.startsWith('**')) {
      out.push(<strong key={k}>{raw.slice(2, -2)}</strong>);
    } else if (raw.startsWith('[')) {
      const [, label, url] = /^\[([^\]]+)\]\((.+)\)$/.exec(raw)!;
      out.push(<ExternalLink key={k} href={url} label={label} />);
    } else if (raw.startsWith('http')) {
      // A trailing full stop or comma belongs to the sentence, not the address.
      const url = raw.replace(/[.,;:!?)]+$/, '');
      out.push(<ExternalLink key={k} href={url} label={url} />, raw.slice(url.length));
    } else {
      out.push(
        <span key={k} className="rounded bg-primary/10 px-1 font-medium text-primary">
          {raw}
        </span>,
      );
    }
    last = at + raw.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2"
    >
      {label}
    </a>
  );
}

/** A comment's markdown: paragraphs, bullet and numbered lists, and the inline forms above. */
export function Markdown({ text, mentions = [] }: { text: string; mentions?: string[] }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="space-y-2 break-words">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        const bullets = lines.every((l) => /^\s*[-*] /.test(l));
        const numbers = lines.every((l) => /^\s*\d+[.)] /.test(l));
        if (bullets || numbers) {
          const List = numbers ? 'ol' : 'ul';
          return (
            <List key={i} className={`ml-5 space-y-0.5 ${numbers ? 'list-decimal' : 'list-disc'}`}>
              {lines.map((line, j) => (
                <li key={j}>
                  {inline(line.replace(/^\s*(?:[-*]|\d+[.)]) /, ''), mentions, `${i}-${j}`)}
                </li>
              ))}
            </List>
          );
        }
        return (
          <p key={i}>
            {lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(line, mentions, `${i}-${j}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
