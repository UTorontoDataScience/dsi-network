import React, { useEffect, useLayoutEffect, useState } from "react";
import {
  create,
  HierarchyCircularNode,
  interpolateHcl,
  interpolateZoom,
  scaleLinear,
  select,
  Selection,
} from "d3";
import { pack, hierarchy } from "d3-hierarchy";
import getModel, {
  AcademicProgram,
  Campus,
  Division,
  EntityType,
  Model,
  Person,
  Relationship,
  Unit,
} from "../data/model";

const Chart: React.FC = () => {
  const [model, setModel] = useState<Model>();
  const [packableData, setPackableData] = useState<PackableNode>();

  useLayoutEffect(() => {
    if (packableData) {
      buildPackChart("test", packableData, 600, 1000);
    }
  }, [packableData]);

  useEffect(() => {
    const _getModel = async () => {
      const model = await getModel();
      setModel(model);
    };
    _getModel();
  }, []);

  useEffect(() => {
    if (model) {
      console.log("starting");
      setPackableData(makePackableData(model));
    }
  }, [model]);

  console.log(packableData);

  return <span id="test" />;
};

type NumberOrString = number | string;
export const groupBy = <
  T extends { [key: NumberOrString]: any },
  K extends keyof T
>(
  data: T[],
  key: T[K] extends NumberOrString ? K : never
) => {
  return data.reduce<{ [key: NumberOrString]: T[] }>(
    (acc, curr) => ({
      ...acc,
      [curr[key]]: acc[curr[key]] ? acc[curr[key]].concat(curr) : [curr],
    }),
    {}
  );
};

/* value is count --> start with people */
interface PackableLeafNode {
  relationship: Relationship;
  value: number;
}

type PackableNodeChild = PackableNode | PackableLeafNode;
interface PackableNode {
  children: PackableNodeChild[];
  entity: ModelEntity;
  relationToParent: Relationship | "root";
  type: EntityType;
}

const getLeafs = (links: HydratedLink[], leafType: EntityType) => {
  const counts = links
    .filter((cl) => cl.childType === leafType)
    .reduce(
      (acc, curr) => ({
        ...acc,
        [curr.relationship]: acc[curr.relationship]
          ? acc[curr.relationship] + 1
          : 1,
      }),
      {} as { [K in Relationship]: number }
    );

  return getKeys(counts).map((k) => ({
    relationship: k,
    value: counts[k],
  })) as PackableLeafNode[];
};

const makeNode = (
  rootId: number,
  rootType: EntityType,
  leafType: EntityType,
  relationship: Relationship | "root",
  links: HydratedLink[]
): PackableNode => {
  const rootEntity = links.find(
    (l) => l.parentType === rootType && l.parent.id === rootId
  )?.parent!;

  const childLinks = links.filter(
    (l) => l.parentType === rootType && l.parent.id === rootId
  );

  const parents = childLinks.filter((cl) => cl.childType !== leafType);

  const res: PackableNode = {
    entity: rootEntity,
    relationToParent: relationship,
    type: rootType,
    children: [
      ...parents.map((c) =>
        makeNode(c.child.id, c.childType, leafType, c.relationship, links)
      ),
      ...getLeafs(childLinks, leafType),
    ],
  };

  return res;
};

type ModelEntity = Unit | Division | Person | AcademicProgram;

interface HydratedLink {
  child: ModelEntity;
  childType: EntityType;
  parent: ModelEntity;
  parentType: EntityType;
  relationship: Relationship;
}

type ModelMap = { [K in keyof Model]: { [id: number]: ModelEntity } };

const getKeys = <T,>(obj: T) => Object.keys(obj) as (keyof T)[];

/* division, unit, program, person, relationship-type-count */
const makePackableData = (model: Model): PackableNode => {
  const { links, ...modelsToHydrate } = model;

  // this is the bottleneck -- can it be done server-side?
  // would a map be faster?

  //this should be done once and memoized
  const modelMap = getKeys(modelsToHydrate).reduce<ModelMap>(
    (acc, k) => ({
      ...acc,
      [k]: Object.values(modelsToHydrate[k]).reduce<{
        [id: number]: ModelEntity;
      }>(
        (acc, curr: ModelEntity) => ({
          ...acc,
          [curr.id]: curr,
        }),
        {}
      ),
    }),
    {} as ModelMap
  );

  const hydrated: HydratedLink[] = links.map((l) => ({
    child: modelMap[l.vType][l.vId],
    childType: l.vType,
    parent: modelMap[l.uType][l.uId],
    parentType: l.uType,
    relationship: l.relationship,
  }));

  //problem is that we need only nodes that have persons as leaves
  //can we use discovery to prune any links that don't have paths to persons?

  const stGeorge = model.campus.find((c) => c.name.includes("eorge")) as Campus;

  return makeNode(stGeorge.id, "campus", "person", "root", hydrated);
};

const buildPackChart = (
  id: string,
  data: PackableNode,
  width: number,
  height: number
) => {
  const root = pack<PackableNode>().size([width, height]).padding(3)(
    hierarchy(data)
      .sum((d) => (d as unknown as PackableLeafNode).value)
      .sort((a, b) => b.value! - a.value!)
  );

  let focus = root;
  let view: [number, number, number];

  const svg = select(`#${id}`)
    .append("svg")
    .attr("viewBox", `-${width / 2} -${height / 2} ${width} ${height}`)
    .style("display", "block")
    .attr("height", height)
    .attr("width", width)
    .on("click", (event, d) => {
      if (focus !== d) {
        zoom(event, root);
      }
      focus = root;
    });

  const margin = { top: 10, right: 10, bottom: 20, left: 40 };

  const getLabel = (node: PackableNodeChild) => {
    if (node.hasOwnProperty("relationship")) {
      return (node as PackableLeafNode).relationship;
    } else if (node.hasOwnProperty("entity")) {
      return (node as PackableNode).entity.name;
    }
  };

  const color = scaleLinear()
    .domain([0, 5])
    // @ts-ignore
    .range(["hsl(152,80%,80%)", "hsl(228,30%,40%)"])
    // @ts-ignore
    .interpolate(interpolateHcl);

  const node = svg
    .append("g")
    .selectAll("circle")
    .data(root.descendants().slice(1))
    .join("circle")
    .attr("fill", (d) => (d.children ? color(1) : "white"))
    .attr("pointer-events", (d) => (!d.children ? "none" : null))
    .attr("r", (d) => d.r)
    .attr("transform", (d) => "translate(" + d.x + "," + d.y + ")")
    .on(
      "click",
      (event, d) => focus !== d && (zoom(event, d), event.stopPropagation())
    )
    .on("mouseover", function () {
      select(this).attr("stroke", "#000");
    })
    .on("mouseout", function () {
      select(this).attr("stroke", null);
    });

  const label = svg
    .append("g")
    .style("font", "10px sans-serif")
    .attr("pointer-events", "none")
    .attr("text-anchor", "middle")
    .selectAll("text")
    .data(root.descendants())
    .join("text")
    .style("fill-opacity", (d) => (d.parent === focus ? 1 : 0))
    .style("display", (d) => {
      return d.parent === focus ? "inline" : "none";
    })
    .attr("transform", (d) => "translate(" + d.x + "," + d.y + ")")
    // todo: every entity also needs a typelabel, including leaves
    .text((d) =>
      d.value ? `${getLabel(d.data)}: ${d.value}` : ""
    ) as Selection<
    SVGTextElement,
    HierarchyCircularNode<PackableNode>,
    any,
    any
  >;

  const zoomTo = (v: [number, number, number]) => {
    const k = width / v[2];

    view = v;

    label.attr("transform", (d) => {
      return `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`;
    });
    node.attr(
      "transform",
      (d) => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`
    );
    node.attr("r", (d) => d.r * k);
  };

  const zoom = (event: MouseEvent, d: HierarchyCircularNode<PackableNode>) => {
    focus = d;

    const transition = svg
      .transition()
      .duration(500)
      .tween("zoom", (d) => {
        const i = interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
        return (t) => zoomTo(i(t));
      });

    label
      .filter(function (d) {
        return d.parent === focus || this.style.display === "inline";
      })
      .transition(transition as any) // hmmm
      .style("fill-opacity", (d) => (d.parent === focus ? 1 : 0))
      .on("start", function (d) {
        if (d.parent === focus) this.style.display = "inline";
      })
      .on("end", function (d) {
        if (d.parent !== focus) this.style.display = "none";
      });
  };

  zoomTo([root.x, root.y, root.r * 2]); // set view

  //return svg.node();
};

export default Chart;
