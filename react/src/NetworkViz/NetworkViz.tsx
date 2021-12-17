import React, { useEffect, useLayoutEffect, useState } from "react";
import d3, { select } from "d3";
import getModel, { Model } from "../data/model";

const Chart: React.FC = () => {
  const [model, setModel] = useState<Model>();

  useLayoutEffect(() => {
    buildChart("test", 600, 1000);
  }, []);

  useEffect(() => {
    const _getModel = async () => {
      const model = await getModel();
      setModel(model);
    };
    _getModel();
  }, []);

  console.log(model);

  return <span id="test" />;
};

const buildChart = (id: string, height: number, width: number) => {
  const svg = select(`#${id}`)
    .append("svg")
    .attr("height", height)
    .attr("width", width);

  const margin = { top: 10, right: 10, bottom: 20, left: 40 };
};

export default Chart;
