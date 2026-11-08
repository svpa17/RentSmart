// RĂSCRUCE AI — curățarea textului citit din pagină. Funcții pure (fără DOM).

export const MAX_TEXT_CHARS = 15000;
export const SHORT_TEXT_CHARS = 300;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    const k = e.toLowerCase();
    if (k in ENTITIES) return ENTITIES[k];
    if (k.startsWith('#x')) return String.fromCodePoint(parseInt(k.slice(2), 16));
    if (k.startsWith('#')) return String.fromCodePoint(Number(k.slice(1)));
    return m;
  });
}

/** HTML simplu (descrieri) → text cu rânduri. Fără DOM, deci inert: nu încarcă nimic, nu rulează nimic. */
export function htmlToText(html) {
  const withBreaks = String(html ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' ');
  return cleanText(decodeEntities(withBreaks));
}

/** Rânduri curățate: spații comprimate, rânduri goale și duplicate consecutive eliminate. */
export function cleanText(text) {
  const out = [];
  for (const raw of String(text ?? '').replace(/\u00a0/g, ' ').split(/\r?\n/)) {
    const line = raw.replace(/[ \t\f\v]+/g, ' ').trim();
    if (!line) continue;
    if (out[out.length - 1] === line) continue;
    out.push(line);
  }
  return out.join('\n');
}

/** Taie textul la limită, la capăt de rând dacă se poate. */
export function limitText(text, max = MAX_TEXT_CHARS) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const nl = cut.lastIndexOf('\n');
  return nl > max * 0.8 ? cut.slice(0, nl) : cut;
}
