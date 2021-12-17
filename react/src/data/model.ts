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
    id,
    is_education: strToBool(u.type_education),
    is_research: strToBool(u.type_research),
    is_resource: strToBool(u.type_resource),
  }));

interface Person {
  id: number;
  firstName: string;
  lastName: string;
  contact: string;
}

interface Division {
  id: number;
  name: string;
}

interface Unit {
  id: number;
  divisionId: number;
  name: string;
}

const makePerson = (): Person => ({
  contact: faker.internet.email(),
  firstName: faker.name.firstName(),
  id: faker.unique(faker.datatype.number),
  lastName: faker.name.lastName(),
});

export interface Model {
  divisions: Division[];
  links: Link[];
  people: Person[];
  programs: AcademicProgram[];
  units: Unit[];
}

type Relationship =
  | "affiliate"
  | "department"
  | "fellow"
  | "graduate_student"
  | "grantee"
  | "postdoc"
  | "primary_investigator"
  | "professor"
  | "program"
  | "researcher"
  | "staff"
  | "support"
  | "undergraduate";

type EntityType = "person" | "program" | "unit" | "division";

interface Link {
  uId: number;
  uType: EntityType;
  vId: number;
  vType: EntityType;
  relationship: Relationship;
}

const createPeopleDivisionsLinksAndUnits = (programs: AcademicProgram[]) => {
  const links: Link[] = [];
  const people: Person[] = [];
  const divisions = [...new Set(programs.map((u) => u.division))]
    .filter(Boolean)
    .map((d, id) => ({
      name: d,
      id,
    }));
  const units = [...new Set(programs.filter((p) => !!p.unit))].map((p, id) => ({
    divisionId: divisions.find((d) => d.name === p.division)?.id,
    id,
    name: p.unit,
  })) as Unit[];

  const populateProgram = (
    program: AcademicProgram,
    relationship: Relationship,
    maxCount: number
  ) => {
    const _people = Array(faker.datatype.number({ min: 1, max: maxCount }))
      .fill(null)
      .map(() => {
        const person = makePerson();
        people.push(person);
        const link = {
          uId: program.id,
          uType: "program" as EntityType,
          vId: person.id,
          vType: "person" as EntityType,
          relationship: relationship,
        };
        links.push(link);
        return person;
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

  // divisions are parents of units (assuming for now they're all departments)
  units.forEach((u) =>
    createLink(u.divisionId, u.id, "division", "unit", "department")
  );

  // units (departments) are parents of programs
  programs.forEach((p) => {
    let divisionId: number | undefined;
    const unitId = p.unit ? units.find((u) => u.name === p.unit)?.id : null;
    if (unitId) {
      createLink(unitId, p.id, "unit", "program", "program");
    } else {
      divisionId = divisions.find((d) => p.division === d.name)?.id;
    }
    if (divisionId) {
      createLink(divisionId, p.id, "division", "program", "program");
    }
  });

  const professorLinks = links
    .filter((l) => l.relationship === "professor")
    .map((l) => l.vId);

  const professors = people.filter((p) => professorLinks.includes(p.id));

  const researcherLinks = links
    .filter((l) =>
      ["researcher", "undergraduate", "graduate student", "postdoc"].includes(
        l.relationship
      )
    )
    .map((l) => l.vId);

  const researchers = people.filter((p) => researcherLinks.includes(p.id));

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

  return { divisions, links, people, units };
};
const getModel = async (): Promise<Model> => {
  const programData = await fetchAcademicProgramsData();
  const programs = transformPrograms(programData);

  const results = {
    programs,
    ...createPeopleDivisionsLinksAndUnits(programs),
  };

  return results;
};

export default getModel;
