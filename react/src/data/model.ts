import {
    AcademicProgram,
    AcademicProgramsDataRaw,
    PersonDataRaw,
    Person,
} from '../types';

// once we're confident, we'll want to save this as json rather than recreating it all the time for the sake of reproducibility

const fetchAcademicProgramsData = async () => {
    return (await (await fetch('academic-programs.json')).json()) as Promise<
        AcademicProgramsDataRaw[]
    >;
};

const strToBool = (type?: string) =>
    type && type.toLowerCase() === 'yes' ? true : false;

const transformPrograms = (data: AcademicProgramsDataRaw[]) =>
    data.map((u, id) => ({
        ...u,
        id: id + 1,
        is_education: strToBool(u.type_education),
        is_research: strToBool(u.type_research),
        is_resource: strToBool(u.type_resource),
        name: u.program,
    }));

const fetchPeopleData = async () => {
    return (await (await fetch('people.json')).json()) as Promise<
        PersonDataRaw[]
    >;
};

const transformPeople = (data: PersonDataRaw[]) =>
    data.map((u, id) => ({
        ...Object.fromEntries(
            Object.entries(u).map(([k, v]) => [
                k,
                k.endsWith('_bool') ? !!v : v,
            ])
        ),
        id: id + 1,
        name: `${u.first} ${u.last}`,
    })) as Person[];

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
    | 'affiliate'
    | 'department'
    | 'division'
    | 'fellow'
    | 'graduate_student'
    | 'grantee'
    | 'postdoc'
    | 'principal_investigator'
    | 'professor'
    | 'program'
    | 'researcher'
    | 'staff'
    | 'support'
    | 'undergraduate';

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

const createDivisionsLinksAndUnits = (
    programs: AcademicProgram[],
    people: Person[]
) => {
    const links: Link[] = [];
    const campus = [...new Set(programs.map(u => u.campus))]
        .filter(Boolean)
        .map((d, id) => ({
            name: d,
            id: id + 1,
        }));

    const division: Division[] = programs
        .map(p => ({
            id: p.id,
            name: p.division,
            campusId: campus.find(c => c.name === p.campus)?.id,
        }))
        .filter(uniqueBy('name'));

    const unit: Unit[] = programs
        .filter(p => !!p.unit)
        .map(p => ({
            id: p.id,
            name: p.unit!,
            divisionId: division.find(d => d.name === p.division)?.id,
        }))
        .filter(uniqueBy('name'));

    const getPersonRelationship = (_role?: string): Relationship => {
        const role = (_role || '').toLowerCase();
        if (role.includes('professor')) {
            return 'professor';
        } else if (role.includes('phd') || role.includes('master')) {
            return 'graduate_student';
        } else if (role.includes('investigator')) {
            return 'principal_investigator';
        } else if (role.includes('undergraduate')) {
            return 'undergraduate';
        } else if (role.includes('research')) {
            return 'researcher';
        }

        return 'staff';
    };

    const transformDepartmentName = (name: string) =>
        (name || '')
            .toLowerCase()
            .replace(/(,|(department of))/g, '')
            .replace('&', 'and')
            .trim();

    const populateUnit = (unit: Unit, people: Person[]) => {
        // just doing department to department for now

        const _people = people
            .filter(
                p =>
                    !!unit.name &&
                    [p.primary_department, p.secondary_department]
                        .map(transformDepartmentName)
                        .includes(transformDepartmentName(unit.name))
            )
            .map(person => {
                const link = {
                    uId: unit.id,
                    uType: 'unit' as EntityType,
                    vId: person.id,
                    vType: 'person' as EntityType,
                    relationship: getPersonRelationship(
                        transformDepartmentName(person.primary_department) ===
                            transformDepartmentName(unit.name)
                            ? person.primary_role
                            : person.secondary_role
                    ),
                };
                links.push(link);
                return person;
            });
        return _people;
    };

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

    //campus is parent of division
    division.forEach(d => {
        if (d.name && d.campusId) {
            createLink(d.campusId, d.id, 'campus', 'division', 'division');
        }
    });

    // divisions are parents of units (assuming for now they're all departments)
    // people data isn't great on programs, so we'll attach to units instead
    unit.forEach(u => {
        if (u.divisionId) {
            createLink(u.divisionId, u.id, 'division', 'unit', 'department');
        }
        populateUnit(u, people);
    });

    // units (departments) are parents of programs
    programs.forEach(p => {
        let divisionId: number | undefined;
        const unitId = p.unit ? unit.find(u => u.name === p.unit)?.id : null;
        if (unitId) {
            createLink(unitId, p.id, 'unit', 'program', 'program');
        } else {
            divisionId = division.find(d => p.division === d.name)?.id;
        }
        if (divisionId) {
            createLink(divisionId, p.id, 'division', 'program', 'program');
        }
    });

    return { campus, division, links, unit };
};
const getModel = async (): Promise<Model> => {
    const programData = await fetchAcademicProgramsData();
    const program = transformPrograms(programData);

    const peopleData = await fetchPeopleData();
    const person = transformPeople(peopleData);

    const results = {
        person,
        program,
        ...createDivisionsLinksAndUnits(program, person),
    };

    return results;
};

export type ModelEntity = Unit | Division | Person | AcademicProgram;

export interface HydratedLink {
    child: ModelEntity;
    childType: EntityType;
    id: number;
    parent: ModelEntity;
    parentType: EntityType;
    relationship: Relationship;
}

type ModelMap = { [K in keyof Model]: { [id: number]: ModelEntity } };

export const getKeys = <T>(obj: T) => Object.keys(obj) as (keyof T)[];

export const hydrateLinks = (model: Model) => {
    const { links, ...modelsToHydrate } = model;

    // this is the bottleneck -- can it be done server-side?

    //this should be done once and memoized at top level
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

    return links.map((l, i) => ({
        child: modelMap[l.vType][l.vId],
        childType: l.vType,
        id: i + 1,
        parent: modelMap[l.uType][l.uId],
        parentType: l.uType,
        relationship: l.relationship,
    }));
};

export interface HierarchicalLeafNode {
    relationship: Relationship;
    value: number;
}

export type HierarchicalNodeChild = HierarchicalNode | HierarchicalLeafNode;
export interface HierarchicalNode {
    children: HierarchicalNodeChild[];
    entity: ModelEntity;
    relationToParent: Relationship | 'root';
    type: EntityType;
}

export default getModel;
