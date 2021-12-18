import React, { useEffect, useLayoutEffect, useState } from "react";
import d3, { select } from "d3";
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
    buildPackChart("test", 600, 1000);
  }, []);

  useEffect(() => {
    const _getModel = async () => {
      const model = await getModel();
      setModel(model);
    };
    _getModel();
  }, []);

  useEffect(() => {
    if (model) {
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

const makeNode = (
  rootId: number,
  relationship: Relationship | "root",
  hierarchy: EntityType[],
  links: HydratedLink[],
  idx = 0
): PackableNode => {
  // we should iterate through hierarchy till we find children, since the link might skip a generation
  const rootEntityType = hierarchy[idx];
  const childEntityType = hierarchy[idx + 1];

  const rootEntity = links.find(
    (l) => l.parentType === rootEntityType && l.parent.id === rootId
  )?.parent;

  if (!rootEntity) {
    //this should have the effect of racing to end, but in future we might want to skip ahead in the hierarchy \
    //and look for children in the next level
    return makeNode(rootId, relationship, hierarchy, links, idx + 1);
  }

  const childLinks = links.filter(
    (l) =>
      l.parentType === rootEntityType &&
      l.childType === childEntityType &&
      l.parent.id === rootId
  );

  // todo: should be implemented only when we have leafs
  const counts = childLinks.reduce(
    (acc, curr) => ({
      ...acc,
      [curr.relationship]: acc[curr.relationship]
        ? acc[curr.relationship] + 1
        : 1,
    }),
    {} as { [K in Relationship]: number }
  );

  const recurse = idx < hierarchy.length - 2;

  const res: PackableNode = {
    entity: rootEntity,
    relationToParent: relationship,
    type: rootEntityType,
    children: recurse
      ? childLinks.map((c) =>
          makeNode(c.child.id, c.relationship, hierarchy, links, idx + 1)
        )
      : getKeys(counts).map((k) => ({ relationship: k, value: counts[k] })),
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

  const stGeorge = model.campus.find((c) => c.name.includes("eorge")) as Campus;

  return makeNode(
    stGeorge.id,
    "root",
    ["campus", "division", "unit", "program", "person"],
    hydrated
  );
};

const buildPackChart = (id: string, height: number, width: number) => {
  const svg = select(`#${id}`)
    .append("svg")
    .attr("height", height)
    .attr("width", width);

  const margin = { top: 10, right: 10, bottom: 20, left: 40 };
};

export default Chart;
