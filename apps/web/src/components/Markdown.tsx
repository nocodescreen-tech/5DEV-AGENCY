import { Fragment } from 'react';

/**
 * Rendu Markdown minimal, sans dangerouslySetInnerHTML : le contenu du modèle
 * est traité comme du texte, jamais comme du HTML. Pas de dépendance externe.
 */
export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/```/);

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((block, i) => {
        // les blocs impairs sont dans des délimiteurs ```
        if (i % 2 === 1) {
          const parts = block.split(String.fromCharCode(10));
          const firstLine = parts[0] ?? '';
          const rest = parts.slice(1);
          const lang = rest.length > 0 ? firstLine.trim() : '';
          const code = (rest.length > 0 ? rest.join('\n') : block).replace(/\n$/, '');
          return (
            <div key={i} className="overflow-hidden rounded-lg border border-line bg-ink/95">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">{lang || 'code'}</span>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(code)}
                  className="text-[10px] uppercase tracking-wider text-white/50 transition hover:text-brand"
                >
                  Copier
                </button>
              </div>
              <pre className="overflow-x-auto p-3 text-[12px] leading-relaxed text-white/90">
                <code>{code}</code>
              </pre>
            </div>
          );
        }
        return <Prose key={i} text={block} />;
      })}
    </div>
  );
}

function inline(text: string, keyBase: string) {
  // **gras**, `code`, reste en texte
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={`${keyBase}-${i}`}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`'))
      return (
        <code key={`${keyBase}-${i}`} className="rounded bg-ink/8 px-1 py-0.5 font-mono text-[12px]">
          {p.slice(1, -1)}
        </code>
      );
    return <Fragment key={`${keyBase}-${i}`}>{p}</Fragment>;
  });
}

function Prose({ text }: { text: string }) {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const out: React.ReactNode[] = [];
  let list: string[] = [];

  const flush = (k: string) => {
    if (!list.length) return;
    out.push(
      <ul key={k} className="list-disc space-y-1 pl-5">
        {list.map((li, i) => (
          <li key={i}>{inline(li, `${k}-${i}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  lines.forEach((line, i) => {
    const t = line.trim();
    if (/^[-*]\s+/.test(t)) {
      list.push(t.replace(/^[-*]\s+/, ''));
      return;
    }
    flush(`l${i}`);
    if (/^#{1,3}\s+/.test(t)) {
      out.push(
        <p key={i} className="font-semibold">
          {t.replace(/^#{1,3}\s+/, '')}
        </p>,
      );
      return;
    }
    out.push(<p key={i}>{inline(t, `p${i}`)}</p>);
  });
  flush('end');

  return <div className="space-y-2">{out}</div>;
}
