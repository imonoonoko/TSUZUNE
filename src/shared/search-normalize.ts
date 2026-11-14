/** Fold Latin accents for suggestions while keeping Japanese voicing marks. */
export function normalizeSuggestionText(value: string): string {
  return value.normalize('NFKD').replace(/(\p{Script=Latin})\p{M}+/gu, '$1').normalize('NFC').toLocaleLowerCase()
}
