export const capitalize = (word: string) =>
    word
        .trim()
        .split('')
        .map((l, i) => (i === 0 ? l.toUpperCase() : l))
        .join('');
