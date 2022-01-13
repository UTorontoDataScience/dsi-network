import 'typeface-roboto';
import React from 'react';
import { Container } from '@mui/material';
import ReactDOM from 'react-dom';
import { ChartPage } from './Pages';

const App: React.FC = () => {
    return (
        <Container maxWidth="xl">
            <ChartPage />
        </Container>
    );
};

ReactDOM.render(<App />, document.getElementById('root'));
