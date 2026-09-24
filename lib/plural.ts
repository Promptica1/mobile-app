// Русское склонение по числу: plural(5, ["вещь", "вещи", "вещей"]) → "5 вещей".
export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word = forms[2];
  if (mod10 === 1 && mod100 !== 11) word = forms[0];
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    word = forms[1];
  return `${n} ${word}`;
}
