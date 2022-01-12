import {
    AcademicProgram,
    AcademicProgramsDataRaw,
    PersonDataRaw,
    Person,
    BaseEntity,
} from '../types';
import { uniqueBy, groupBy } from '../util';

const fetchAcademicProgramsData = async () => {
    return (await (await fetch('academic-programs.json')).json()) as Promise<
        AcademicProgramsDataRaw[]
    >;
};

const yesToBool = (str?: string) =>
    str && str.toLowerCase() === 'yes' ? true : false;

const transformPrograms = (data: AcademicProgramsDataRaw[]) => {
    const programMap = groupBy(data, 'program');

    return data.map<AcademicProgram>((u, id) => ({
        ...u,
        id: id + 1,
        is_education: yesToBool(u.type_education),
        is_research: yesToBool(u.type_research),
        is_resource: yesToBool(u.type_resource),
        name:
            programMap[u.program].length > 1
                ? `${u.program} (${u.campus})`
                : u.program,
        type: 'program' as const,
    }));
};

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
        type: 'person',
    })) as Person[];

export type Campus = BaseEntity;

export interface Division extends BaseEntity {
    campusId?: number;
}

export interface Unit extends BaseEntity {
    divisionId?: number;
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
            type: 'campus' as const,
        }));

    const division: Division[] = programs
        .map(p => ({
            id: p.id,
            name: p.division,
            campusId: campus.find(c => c.name === p.campus)?.id,
            type: 'division' as const,
        }))
        .filter(uniqueBy('name'));

    const unit: Unit[] = programs
        .filter(p => !!p.unit)
        .map(p => ({
            id: p.id,
            name: p.unit!,
            divisionId: division.find(d => d.name === p.division)?.id,
            type: 'unit' as const,
        }))
        .filter(uniqueBy('name'));

    // people should be limited to these roles already
    const getPersonRelationship = (_role?: string): Relationship => {
        const role = (_role || '').toLowerCase();
        if (role.includes('professor')) {
            return 'professor';
        } else return 'principal_investigator';
    };

    const transformDepartmentName = (name: string) =>
        (name || '')
            .toLowerCase()
            .replace(/(,|(department of))/g, '')
            .replace('&', 'and')
            .trim();

    const populateUnit = (unit: Unit, people: Person[]) => {
        // just doing department to department for now

        const _people = people.map(person => {
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

    /* filter out all but PIs and professors and map to departments */
    const departmentMap = people.reduce<{ [key: string]: [Person] }>(
        (acc, curr) => {
            const primaryDepartment = transformDepartmentName(
                curr.primary_department
            );
            const secondaryDepartment = transformDepartmentName(
                curr.secondary_department
            );
            if (
                curr.primary_role &&
                primaryDepartment &&
                (curr.primary_role.toLowerCase().includes('professor') ||
                    curr.primary_role.toLowerCase().includes('investigator'))
            ) {
                acc[primaryDepartment]
                    ? acc[primaryDepartment].push(curr)
                    : (acc[primaryDepartment] = [curr]);
            }

            if (
                curr.secondary_role &&
                secondaryDepartment &&
                (curr.secondary_role.toLowerCase().includes('investigator') ||
                    curr.secondary_role.toLowerCase().includes('professor'))
            ) {
                acc[secondaryDepartment]
                    ? acc[secondaryDepartment].push(curr)
                    : (acc[secondaryDepartment] = [curr]);
            }

            return acc;
        },
        {}
    );

    // divisions are parents of units (assuming for now units are all departments)
    // people data doesn't typically map to programs (e.g., a major), so we'll attach to units instead
    unit.forEach(u => {
        // link department to division
        if (u.divisionId) {
            createLink(u.divisionId, u.id, 'division', 'unit', 'department');
        }
        //add people to department
        if (departmentMap[transformDepartmentName(u.name)]) {
            populateUnit(u, departmentMap[transformDepartmentName(u.name)]);
        }
    });

    // units (departments) are parents of programs -- try linking there first, before division
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

//todo: d3.hierarchy can probably take it from here
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

    // this is slow, needss to be rethought/optimized

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
