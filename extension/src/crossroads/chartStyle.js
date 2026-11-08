// RentSmart — culorile și dimensiunile etichetelor din graficul economiilor (fără componente, ca să fie partajabile).

/** Tonurile etichetelor rotunjite: fundal pastel + text închis (contrast AA). */
export const TONES = Object.freeze({
  orange: { bg: '#FFF1DB', text: '#9A5200', line: '#FF9500' },
  green: { bg: '#E4F6E8', text: '#1E7B34', line: '#34A853' },
  red: { bg: '#FFE6E4', text: '#C4001A', line: '#FF3B30' },
});

/** Lățimea aproximativă a unui text (fără măsurare în DOM, ca desenul să fie determinist). */
export const textWidth = (s, fontSize) => s.length * fontSize * 0.57;

/** Dimensiunile unei etichete rotunjite cu iconiță. */
export function calloutSize(label, fontSize) {
  const h = Math.round(fontSize * 2.3);
  const icon = fontSize + 3;
  return { w: Math.round(textWidth(label, fontSize) + icon + fontSize * 2.1), h, icon };
}
