import { createTheme } from '@mui/material/styles';

const getTheme = (darkMode?: boolean) => {
    const mainColors = {
        primary: {
            main: '#0052cc',
        },
        secondary: {
            main: '#edf2ff',
        },
    };

    const darkPalette = {
        background: {
            default: '#121212',
        },
    };

    return createTheme({
        palette: {
            mode: darkMode ? 'dark' : 'light',
            ...(darkMode ? darkPalette : {}),
            ...mainColors,
        },
    });
};

export default getTheme;
