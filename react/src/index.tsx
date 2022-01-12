import "typeface-roboto";
import { ChartPage } from "./Pages";
import { Container } from "@mui/material";
import React from "react";
import ReactDOM from "react-dom";

const App: React.FC = () => {
  return (
    <Container>
      <ChartPage />
    </Container>
  );
};

ReactDOM.render(<App />, document.getElementById("root"));
