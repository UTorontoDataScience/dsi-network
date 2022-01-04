import React from 'react';
import ReactDOM from 'react-dom';
import { ChartPage } from './Pages';

const App: React.FC = () => {
    return <ChartPage />;
};

ReactDOM.render(<App />, document.getElementById('root'));
