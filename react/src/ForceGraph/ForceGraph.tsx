import {
  BaseType,
  hierarchy,
  HierarchyNode,
  select,
  Selection,
  SimulationLinkDatum,
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

/* for correct tying for data annotated with coordinates by forceLink/simulation, we need to extend these interfaces */
interface ForceNodeWrapper<T> extends HierarchyNode<T>, SimulationNodeDatum {}
interface ForceLinkWrapper<T> extends SimulationLinkDatum<T> {}

const buildForceGraph = (
  _nodes: HierarchicalNode,
  selector: string,
  width: number,
  height: number
) => {
  const root = hierarchy(_nodes);
  const links = root.links();
  const nodes = root.descendants();

  const forceLinks = forceLink<
    ForceNodeWrapper<HierarchicalNode>,
    ForceLinkWrapper<ForceNodeWrapper<HierarchicalNode>>
  >(links)
    .distance(0)
    .strength(1);

  const simulation = forceSimulation<ForceNodeWrapper<HierarchicalNode>>(nodes)
    .force("link", forceLinks)
    .force("charge", forceManyBody().strength(-25))
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
    .data(forceLinks.links())
    .join("line");

  const node = svg
    .append("g")
    .attr("fill", "#fff")
    .attr("stroke", "#000")
    .attr("stroke-width", 1.5)
    .selectAll("circle")
    .data(simulation.nodes())
    .join("circle")
    .attr("fill", (d) => (d.children ? null : "#000"))
    .attr("stroke", (d) => (d.children ? null : "#fff"))
    .attr("r", 3.5);
  //.call(drag(simulation));

  node.append("title").text((d) => d.data.entity.name);

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => (d.source as ForceNodeWrapper<HierarchicalNode>).x!)
      .attr("y1", (d) => (d.source as ForceNodeWrapper<HierarchicalNode>).y!)
      .attr("x2", (d) => (d.target as ForceNodeWrapper<HierarchicalNode>).x!)
      .attr("y2", (d) => (d.target as ForceNodeWrapper<HierarchicalNode>).y!);

    node.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!);
  });

  return svg.node();
};

export default ForceGraph;
