export const capitalize = (word: string) =>
  word
    .trim()
    .split("")
    .map((l, i) => (i === 0 ? l.toUpperCase() : l))
    .join("");

export const uniqueBy =
  <T extends Record<string, unknown>, K extends keyof T>(field: K) =>
  (m: T, i: number, arr: T[]) =>
    arr.findIndex((model: T) => model[field] === m[field]) === i;

export const groupBy = <T extends { [key: string]: any }, K extends keyof T>(
  items: T[],
  field: T[K]
) =>
  items.reduce<{ [key: string]: T[] }>(
    (acc, curr) => ({
      ...acc,
      [curr[field]]: acc[curr[field]] ? acc[curr[field]].concat(curr) : [curr],
    }),
    {}
  );
