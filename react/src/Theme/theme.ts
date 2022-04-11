import { createTheme } from '@mui/material/styles';

const getTheme = (darkMode?: boolean) => {
    const mainColors = {
        primary: {
            main: 'rgb(0, 42, 92)',
        },
        secondary: {
            main: 'rgb(1, 30, 66)',
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
        components: {
            MuiLink: {
                styleOverrides: {
                    root: {
                        color: darkMode ? 'white' : mainColors.primary.main,
                    },
                },
            },
        },
    });
};

export default getTheme;
