const rules = new Map<string, Intl.PluralRules>();

/** Picks the CLDR plural form for `count` (falls back to `other`). */
export function plural(
  locale: string,
  count: number,
  forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string },
): string {
  let pr = rules.get(locale);
  if (!pr) {
    pr = new Intl.PluralRules(locale);
    rules.set(locale, pr);
  }
  return forms[pr.select(count)] ?? forms.other;
}
