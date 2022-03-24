import { capitalize } from '@mui/material';

export const compose =
    <T>(...fns: ((arg: T) => any)[]) =>
    (arg: T) => {
        let res = arg;
        for (let i = 0; i < fns.length; i++) {
            res = fns[i](res);
        }
        return res;
    };

export const getKeys = <T extends object>(obj: T) =>
    Object.keys(obj) as (keyof T)[];

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

export const snakeToSpace = (str: string) => str.replace(/_/g, ' ');

export const toProperCase = (str: string) =>
    str
        .trim()
        .split(/\W+/)
        .map(w => capitalize(w.toLowerCase()))
        .join(' ');

export const uniqueBy =
    <T extends object, K extends keyof T>(field: K | ((arg: T) => string)) =>
    (m: T, i: number, arr: T[]) =>
        arr.findIndex((model: T) => {
            return typeof field === 'function'
                ? field(model) === field(m)
                : model[field] === m[field];
        }) === i;
