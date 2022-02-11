import 'typeface-roboto';
import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import {
    AppBar,
    Box,
    Container,
    CssBaseline,
    FormControlLabel,
    Grid,
    Switch,
    Typography,
} from '@mui/material';
import { ThemeProvider } from '@mui/system';
import { ChartPage } from './Pages';
import getTheme from './Theme/theme';

const App: React.FC = () => {
    const [darkMode, setDarkMode] = useState(
        !!window.localStorage.getItem('darkMode')
    );

    const theme = useMemo(() => getTheme(darkMode), [darkMode]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Container maxWidth="xl">
                <AppBar position="static">
                    <Box padding={3}>
                        <Grid container direction="row">
                            <Grid item xs={4}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            onChange={() => {
                                                if (darkMode) {
                                                    window.localStorage.removeItem(
                                                        'darkMode'
                                                    );
                                                } else {
                                                    window.localStorage.setItem(
                                                        'darkMode',
                                                        'yes'
                                                    );
                                                }
                                                setDarkMode(!darkMode);
                                            }}
                                            checked={darkMode}
                                        />
                                    }
                                    label={
                                        darkMode ? 'Dark Mode' : 'Light Mode'
                                    }
                                />
                            </Grid>
                            <Grid item xs={4}>
                                <Typography align="center" variant="h4">
                                    DSI Network
                                </Typography>
                            </Grid>
                            <Grid item xs={4}></Grid>
                        </Grid>
                    </Box>
                </AppBar>
                <ChartPage />
            </Container>
        </ThemeProvider>
    );
};

ReactDOM.render(<App />, document.getElementById('root'));
