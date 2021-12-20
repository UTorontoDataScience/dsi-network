import React from "react";
import ReactDOM from "react-dom";
import NetworkViz from "./NetworkViz/NetworkViz";

const App: React.FC = () => (
  <div
    style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
  >
    <NetworkViz />
  </div>
);

ReactDOM.render(<App />, document.getElementById("root"));
