import React from 'react';
import ReactDOM from 'react-dom';
import { ChartPage } from './Pages';
import 'typeface-roboto';
import { AppBar, Box, Container, Typography } from '@mui/material';

const App: React.FC = () => {
    return (
        <Container>
            <ChartPage />
        </Container>
    );
};

ReactDOM.render(<App />, document.getElementById('root'));
