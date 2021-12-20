import {
  hierarchy,
  HierarchyLink,
  HierarchyNode,
  select,
  SimulationNodeDatum,
} from "d3";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceX,
  forceY,
} from "d3-force";
import React, { useEffect, useLayoutEffect, useState } from "react";
import getModel, {
  Campus,
  EntityType,
  HierarchicalNode,
  HydratedLink,
  hydrateLinks,
  Model,
  ModelEntity,
  Relationship,
} from "../data/model";

const ForceGraph: React.FC<{}> = () => {
  const [model, setModel] = useState<Model>();
  const [nodes, setNodes] = useState<HierarchicalNode>();

  useLayoutEffect(() => {
    if (nodes) {
      buildForceGraph(nodes, "test", 600, 1000);
    }
  }, [nodes]);

  useEffect(() => {
    const _getModel = async () => {
      const model = await getModel();
      setModel(model);
    };
    _getModel();
  }, []);

  useEffect(() => {
    if (model) {
      const stGeorge = model.campus.find((c) =>
        c.name.includes("eorge")
      ) as Campus;

      setNodes(buildTree(stGeorge, "campus", "root", hydrateLinks(model)));
    }
  }, [model]);

  return <span id="test" />;
};

const buildTree = (
  root: ModelEntity,
  rootType: EntityType,
  relationship: Relationship | "root",
  links: HydratedLink[]
): HierarchicalNode => {
  const childLinks = links.filter(
    (l) => l.parentType === rootType && l.parent.id === root.id
  );

  const res: HierarchicalNode = {
    entity: root,
    relationToParent: relationship,
    type: rootType,
    children: [
      ...childLinks.map((c) =>
        buildTree(c.child, c.childType, c.relationship, links)
      ),
    ],
  };

  return res;
};

const buildForceGraph = (
  _nodes: HierarchicalNode,
  selector: string,
  width: number,
  height: number
) => {
  const root = hierarchy(_nodes);
  const links = root.links();
  const nodes = root.descendants();

  //i think this mutates links...
  const simulation = forceSimulation(nodes as SimulationNodeDatum[])
    .force(
      "link",
      forceLink<any, HierarchyLink<HierarchicalNode>>(links)
        /*         .id((d: HierarchyNode<HierarchicalNode>) => {
          return `${d.data.entity.id}-${d.data.type}`;
        }) */
        .distance(0)
        .strength(1)
    )
    .force("charge", forceManyBody().strength(-50))
    .force("x", forceX())
    .force("y", forceY());

  const svg = select(`#${selector}`)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [-width / 2, -height / 2, width, height]);

  const link = svg
    .append("g")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(links)
    .join("line");

  const node = svg
    .append("g")
    .attr("fill", "#fff")
    .attr("stroke", "#000")
    .attr("stroke-width", 1.5)
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("fill", (d) => (d.children ? null : "#000"))
    .attr("stroke", (d) => (d.children ? null : "#fff"))
    .attr("r", 3.5);
  //.call(drag(simulation));

  node.append("title").text((d) => d.data.entity.name);

  simulation.on("tick", () => {
    link
      // @ts-ignore -- i think source has been mutated (yeah it has x,y, vx,vy)
      .attr("x1", (d) => d.source.x)
      // @ts-ignore
      .attr("y1", (d) => d.source.y)
      // @ts-ignore
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => {
        // @ts-ignore
        return d.target.y;
      });

    // @ts-ignore
    node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
  });

  return svg.node();
};

export default ForceGraph;
