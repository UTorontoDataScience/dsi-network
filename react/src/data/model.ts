import faker from "faker";

// note that for now 'er really only under the auspices of u of t

// also, once we're confident, we'll want to save this as json rather than recreating it all the time for the sake of reproducibility

interface AcademicProgramsData {
  campus: string;
  division: string;
  unit: string | null; // department, typically
  program: string;
  short_name: string;
  type_education: string;
  subtype_education: string;
  work_integrated_learning_experience: string;
  type_research: string;
  subtype_research: string;
  type_resource: string;
  resource_subtype_database: string;
  resource_substype_infrastructure: string;
  resource_subtype_service: string;
  resource_subtype_software: string;
  resource_subtype_training: string;
  type_event_removed: string;
  degree_designation: string;
  short_description: string;
  audience: string;
  key_words_tags: string;
  url: string;
  alt_links: string;
  year_established: string;
  date_if_event_: string;
  questions: string;
  hl_response: string;
}

export interface AcademicProgram extends AcademicProgramsData {
  id: number;
  is_research: boolean;
  is_resource: boolean;
  is_education: boolean;
  name: string;
}

const fetchAcademicProgramsData = async () => {
  return (await (await fetch("academic-programs.json")).json()) as Promise<
    AcademicProgramsData[]
  >;
};

const strToBool = (type?: string) =>
  type && type.toLowerCase() === "yes" ? true : false;

const transformPrograms = (data: AcademicProgramsData[]) =>
  data.map((u, id) => ({
    ...u,
    id: id + 1,
    is_education: strToBool(u.type_education),
    is_research: strToBool(u.type_research),
    is_resource: strToBool(u.type_resource),
    name: u.program,
  }));

export interface Person {
  contact: string;
  id: number;
  name: string;
}

export interface Campus {
  name: string;
  id: number;
}

export interface Division {
  campusId?: number;
  id: number;
  name: string;
}

export interface Unit {
  id: number;
  divisionId?: number;
  name: string;
}

const makePerson = (): Person => ({
  contact: faker.internet.email(),
  name: `${faker.name.firstName()} ${faker.name.lastName()}`,
  id: faker.unique(faker.datatype.number),
});

export interface EntityDict {
  campus: Campus[];
  division: Division[];
  person: Person[];
  program: AcademicProgram[];
  unit: Unit[];
}

export interface Model extends EntityDict {
  links: Link[];
}

export type Relationship =
  | "affiliate"
  | "department"
  | "division"
  | "fellow"
  | "graduate_student"
  | "grantee"
  | "location"
  | "postdoc"
  | "primary_investigator"
  | "professor"
  | "program"
  | "researcher"
  | "staff"
  | "support"
  | "undergraduate";

export type EntityType = keyof EntityDict;

export interface Link {
  uId: number;
  uType: EntityType;
  vId: number;
  vType: EntityType;
  relationship: Relationship;
}

const uniqueBy =
  <T extends {}, K extends keyof T>(field: K) =>
  (m: T, i: number, arr: T[]) =>
    arr.findIndex((model: T) => model[field] === m[field]) === i;

const createPeopleDivisionsLinksAndUnits = (programs: AcademicProgram[]) => {
  const links: Link[] = [];
  const person: Person[] = [];
  const campus = [...new Set(programs.map((u) => u.campus))]
    .filter(Boolean)
    .map((d, id) => ({
      name: d,
      id: id + 1,
    }));

  const division: Division[] = programs
    .map((p) => ({
      id: p.id,
      name: p.division,
      campusId: campus.find((c) => c.name === p.campus)?.id,
    }))
    .filter(uniqueBy("name"));

  const unit: Unit[] = programs
    .filter((p) => !!p.unit)
    .map((p) => ({
      id: p.id,
      name: p.unit!,
      divisionId: division.find((d) => d.name === p.division)?.id,
    }))
    .filter(uniqueBy("name"));

  const populateProgram = (
    program: AcademicProgram,
    relationship: Relationship,
    maxCount: number
  ) => {
    const _people = Array(faker.datatype.number({ min: 1, max: maxCount }))
      .fill(null)
      .map(() => {
        const _person = makePerson();
        person.push(_person);
        const link = {
          uId: program.id,
          uType: "program" as EntityType,
          vId: _person.id,
          vType: "person" as EntityType,
          relationship: relationship,
        };
        links.push(link);
        return _person;
      });
    return _people;
  };

  const createProgramToPersonLink = (
    uId: number,
    vId: number,
    relationship: Relationship
  ) => createLink(uId, vId, "program", "person", relationship);

  const createLink = (
    uId: number,
    vId: number,
    uType: EntityType,
    vType: EntityType,
    relationship: Relationship
  ) => {
    const link = {
      uId,
      vId,
      uType,
      vType,
      relationship,
    };
    links.push(link);
    return link;
  };

  programs.forEach((program) => {
    if (program.is_education) {
      populateProgram(program, "professor", 3);
      populateProgram(program, "postdoc", 3);
      populateProgram(program, "graduate_student", 7);
      populateProgram(program, "undergraduate", 14);
      populateProgram(program, "staff", 8);
    }
    if (program.is_research) {
      populateProgram(program, "researcher", 8);
      populateProgram(program, "primary_investigator", 2);
      populateProgram(program, "staff", 8);
      populateProgram(program, "postdoc", 3);
    }

    if (program.is_resource) {
      populateProgram(program, "researcher", 5);
      populateProgram(program, "staff", 4);
    }
  });

  //campus is parent of division
  division.forEach((d) => {
    if (d.campusId) {
      createLink(d.campusId, d.id, "campus", "division", "location");
    }
  });

  // divisions are parents of units (assuming for now they're all departments)
  unit.forEach((u) => {
    if (u.divisionId) {
      createLink(u.divisionId, u.id, "division", "unit", "department");
    }
  });

  // units (departments) are parents of programs
  programs.forEach((p) => {
    let divisionId: number | undefined;
    const unitId = p.unit ? unit.find((u) => u.name === p.unit)?.id : null;
    if (unitId) {
      createLink(unitId, p.id, "unit", "program", "program");
    } else {
      divisionId = division.find((d) => p.division === d.name)?.id;
    }
    if (divisionId) {
      createLink(divisionId, p.id, "division", "program", "program");
    }
  });

  const professorLinks = links
    .filter((l) => l.relationship === "professor")
    .map((l) => l.vId);

  const professors = person.filter((p) => professorLinks.includes(p.id));

  const researcherLinks = links
    .filter((l) =>
      ["researcher", "undergraduate", "graduate student", "postdoc"].includes(
        l.relationship
      )
    )
    .map((l) => l.vId);

  const researchers = person.filter((p) => researcherLinks.includes(p.id));

  //make some random professors PIs in research programs
  programs.forEach((p) => {
    if (p.is_research) {
      const piIdx = faker.datatype.number({
        min: 0,
        max: professors.length - 1,
      });
      const pi = professors.find((_pi, i) => i === piIdx);
      createProgramToPersonLink(p.id, pi!.id, "primary_investigator");
      professors.splice(piIdx, 1);

      const rIdx = faker.datatype.number({
        min: 0,
        max: researchers.length - 1,
      });
      const r = researchers.find((_pi, i) => i === rIdx);
      createProgramToPersonLink(p.id, r!.id, "affiliate");
    }

    if (p.is_resource) {
      const rIdx = faker.datatype.number({
        min: 0,
        max: researchers.length - 1,
      });
      const r = researchers.find((_pi, i) => i === rIdx);
      createProgramToPersonLink(p.id, r!.id, "affiliate");
    }
  });

  return { campus, division, links, person, unit };
};
const getModel = async (): Promise<Model> => {
  const programData = await fetchAcademicProgramsData();
  const program = transformPrograms(programData);

  const results = {
    program,
    ...createPeopleDivisionsLinksAndUnits(program),
  };

  return results;
};

export default getModel;
