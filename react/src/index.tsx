import React from "react";
import ReactDOM from "react-dom";
import NetworkViz from "./NetworkViz/NetworkViz";

const App: React.FC = () => (
  <div>
    <span>foo</span>
    <NetworkViz />
  </div>
);

ReactDOM.render(<App />, document.getElementById("root"));
