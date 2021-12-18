import React, { useEffect, useLayoutEffect, useState } from "react";
import d3, { select } from "d3";
import getModel, {
  AcademicProgram,
  Division,
  EntityType,
  Link,
  Model,
  Person,
  Relationship,
  Unit,
} from "../data/model";

const Chart: React.FC = () => {
  const [model, setModel] = useState<Model>();
  const [packableData, setPackableData] = useState<PackableData>();

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

interface PackableBase {
  name: Relationship;
}

/* value is count --> start with people */
interface PackableLeafNode extends PackableBase {
  value: number;
}

type PackableDataChild = PackableData | PackableLeafNode;
interface PackableData extends PackableBase {
  children: PackableDataChild[];
}

const findChildren = (
  hierarchy: EntityType[],
  links: HydratedLink[]
): PackableDataChild[] => {
  const name = hierarchy.shift();
  const childName = hierarchy[0];

  // note when cleaning up that this is all you need, can combine entries checks with reduce here and be done
  const byRelationship = links
    .filter((l) => l.parentType === name && l.childType === childName)
    .reduce(
      (acc, curr) => ({
        ...acc,
        [curr.relationship]: acc[curr.relationship]
          ? acc[curr.relationship] + 1
          : 1,
      }),
      {} as { [K in Relationship]: number }
    );

  if (hierarchy.length > 1) {
    return Object.keys(byRelationship).map((k) => ({
      name: k as Relationship,
      children: findChildren(hierarchy, links),
    }));
  }

  return Object.entries(byRelationship).map(([k, v]) => ({
    name: k as Relationship,
    value: v,
  }));
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
const makePackableData = (model: Model): PackableData => {
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

  const root = {
    name: "root" as Relationship, // oof
    children: findChildren(["division", "unit", "program", "person"], hydrated),
  };

  return root;
};

const buildPackChart = (id: string, height: number, width: number) => {
  const svg = select(`#${id}`)
    .append("svg")
    .attr("height", height)
    .attr("width", width);

  const margin = { top: 10, right: 10, bottom: 20, left: 40 };
};

export default Chart;
