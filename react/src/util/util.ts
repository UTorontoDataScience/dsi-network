export const capitalize = (word: string) =>
    word
        .trim()
        .split('')
        .map((l, i) => (i ? l : l.toUpperCase()))
        .join('');

export const uniqueBy =
    <T extends object, K extends keyof T>(field: K) =>
    (m: T, i: number, arr: T[]) =>
        arr.findIndex((model: T) => model[field] === m[field]) === i;

export function groupBy<T extends Record<string, any>, K extends keyof T>(
    items: T[],
    field: T[K] | ((arg: T) => string)
) {
    return items.reduce<{ [key: string]: T[] }>((acc, curr) => {
        const key =
            typeof field === 'function'
                ? (field as (arg: T) => string)(curr)
                : curr[field];
        return {
            ...acc,
            [key]: acc[key] ? acc[key].concat(curr) : [curr],
        };
    }, {});
}

export const getKeys = <T extends object>(obj: T) =>
    Object.keys(obj) as (keyof T)[];
