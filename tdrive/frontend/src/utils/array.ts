/**
 * Sort the provided `array` by using the `getter` on each item to return a value, which
 * is compared in a way that humans find natural (case and diacritic insensitive, ordinal
 * for numeric segments)
 */
export function sortNaturally(array: string[]): string[];
export function sortNaturally<TElement>(array: TElement[], getter: (x: TElement) => string): TElement[];
export function sortNaturally<TElement>(array: TElement[], getter?: (x: TElement) => string): TElement[] {
  const get = getter ?? ((x) => x as string);
  array.sort((a, b) => get(a).localeCompare(get(b), undefined, {
      numeric: true,
      sensitivity: 'base'
    }));
  return array;
}