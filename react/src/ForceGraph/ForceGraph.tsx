import { hierarchy, HierarchyNode } from "d3-hierarchy";
import { select } from "d3-selection";
import { transition } from "d3-transition";
//import { transition } from "d3";

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceX,
  forceY,
  SimulationLinkDatum,
  SimulationNodeDatum,
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
import { BaseType } from "d3";

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

interface ForceNode extends HierarchicalNode {
  selected?: boolean;
}

/* for correct tying for data annotated with coordinates by forceLink/simulation, we need to extend these interfaces */
interface ForceNodeWrapper<T> extends HierarchyNode<T>, SimulationNodeDatum {}
interface ForceLinkWrapper<T> extends SimulationLinkDatum<T> {}

const buildForceGraph = (
  _nodes: ForceNode,
  selector: string,
  width: number,
  height: number
) => {
  const root = hierarchy(_nodes);
  const links = root.links();
  const nodes = root.descendants();

  const forceLinks = forceLink<
    ForceNodeWrapper<ForceNode>,
    ForceLinkWrapper<ForceNodeWrapper<ForceNode>>
  >(links)
    .distance(0)
    .strength(1);

  const simulation = forceSimulation<ForceNodeWrapper<ForceNode>>(nodes)
    .force("link", forceLinks)
    .force("charge", forceManyBody().strength(-25))
    .force("x", forceX())
    .force("y", forceY())
    .velocityDecay(0.8); //higher is faster, default is .4

  const svg = select(`#${selector}`)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [-width / 2, -height / 2, width, height]);

  const link = svg
    .append("g")
    .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(forceLinks.links())
    .join("line")
    .attr("stroke", (d) =>
      (d.target as ForceNodeWrapper<ForceNode>).data.selected &&
      (d.target as ForceNodeWrapper<ForceNode>).data.selected
        ? "red"
        : "black"
    );

  setTimeout(() => {
    const _nodes = nodes.map((n) => {
      n.data.entity.name === "Gary Bader"
        ? (n.data.selected = true)
        : (n.data.selected = false);
      return n;
    });

    /* would be great to add radial force away from selected node, also, animate the transition to red (make big then small) */
    node
      .data(_nodes)
      .join("circle")
      .attr("fill", (d) =>
        d.children ? null : d.data.selected ? "red" : "black"
      )
      .attr("stroke", (d) => (d.children ? null : "#fff"))
      .attr("r", (d) => (d.data.selected ? 7 : 3.5));

    simulation.alpha(0.4).restart();
  }, 5000);

  const node = svg
    .append("g")
    .attr("fill", "#fff")
    .attr("stroke", "#000")
    .attr("stroke-width", 1.5)
    .selectAll("circle")
    .data(simulation.nodes())
    .join("circle")
    .attr("fill", (d) =>
      d.children ? null : d.data.selected ? "red" : "black"
    )
    .attr("stroke", (d) => (d.children ? null : "#fff"))
    .attr("r", 3.5);
  //.call(drag(simulation));

  node.append("title").text((d) => d.data.entity.name);

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => (d.source as ForceNodeWrapper<ForceNode>).x!)
      .attr("y1", (d) => (d.source as ForceNodeWrapper<ForceNode>).y!)
      .attr("x2", (d) => (d.target as ForceNodeWrapper<ForceNode>).x!)
      .attr("y2", (d) => (d.target as ForceNodeWrapper<ForceNode>).y!);

    node.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!);
  });

  return svg.node();
};

export default ForceGraph;
