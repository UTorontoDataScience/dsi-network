import 'typeface-roboto';
import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import styled from '@emotion/styled';
import {
    AppBar,
    Box,
    Container,
    CssBaseline,
    FormControlLabel,
    Grid,
    Link,
    Switch,
    Toolbar,
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
            <AppBar
                position="relative"
                sx={{
                    minHeight: '120px',
                    top: '8px',
                    alignItems: 'center',
                }}
            >
                <Toolbar
                    sx={{
                        flexGrow: 1,
                        flexDirection: 'row',
                        maxWidth: '1200px',
                        width: '100%',
                        padding: '15px',
                    }}
                >
                    <Grid
                        container
                        direction="row"
                        flexWrap="nowrap"
                        justifyContent="space-between"
                    >
                        <Grid item container alignItems="center" flexGrow={1}>
                            <Box sx={{ maxHeight: '70px', display: 'flex' }}>
                                <Link href="https://datasciences.utoronto.ca/">
                                    <img
                                        src="DSI-Reverse-Signature-Lock-Up_Screen-768x124.png"
                                        height="100%"
                                    />
                                </Link>
                            </Box>
                        </Grid>
                        <Grid
                            item
                            container
                            flexDirection="column"
                            justifyContent="space-between"
                            alignItems="flex-end"
                            flexGrow={1}
                            sx={{ padding: '8px' }}
                        >
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
                                label={darkMode ? 'Dark Mode' : 'Light Mode'}
                            />
                            <HeaderLink
                                target="_blank"
                                href="https://survey.alchemer-ca.com/s3/50116588/577c402f69fc"
                            >
                                Become a Member &gt;
                            </HeaderLink>
                        </Grid>
                    </Grid>
                </Toolbar>
                <Toolbar
                    sx={{
                        backgroundColor: theme.palette.secondary.main,
                        justifyContent: 'center',
                        width: '100%',
                    }}
                >
                    <Title>DSI Research Network</Title>
                </Toolbar>
            </AppBar>
            <Container maxWidth="xl">
                <ChartPage />
            </Container>
        </ThemeProvider>
    );
};

const HeaderLink = styled(Link)`
    color: white;
    text-decoration: underline;
`;

const Title = styled.h4`
    font-family: Helvetica;
    font-size: 36px;
    font-weight: 300;
    margin: 10px;
    padding: 10px;
`;

ReactDOM.render(<App />, document.getElementById('root'));
