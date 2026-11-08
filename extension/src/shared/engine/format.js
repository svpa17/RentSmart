// RĂSCRUCE AI — formatarea sumelor în mesajele motorului (separatorul de mii românesc: 1.950 RON).
const nf = new Intl.NumberFormat('ro-RO');

/** „1.950 RON”, „−1.700 RON”. */
export function ron(n) {
  return `${nf.format(n)} RON`;
}
