import React from "react";
import ReactDOM from "react-dom";
import NetworkViz from "./PackChart/PackChart";
import ForceGraph from "./ForceGraph/ForceGraph";

const App: React.FC = () => (
  <div
    style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
  >
    {/* <NetworkViz />  */}
    {<ForceGraph />}
  </div>
);

ReactDOM.render(<App />, document.getElementById("root"));
