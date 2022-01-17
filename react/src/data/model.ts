import { datatype } from 'faker';
import {
    AcademicProgram,
    AcademicProgramsDataRaw,
    PersonDataRaw,
    Person,
    BaseEntity,
} from '../types';
import { getKeys, groupBy, uniqueBy } from '../util/util';

const fetchAcademicProgramsData = async () => {
    return (await (await fetch('academic-programs.json')).json()) as Promise<
        AcademicProgramsDataRaw[]
    >;
};

export type Relationship =
    | 'affiliate'
    | 'department'
    | 'campus'
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

export interface EntityDict {
    campus: Campus[];
    division: Division[];
    institution: Institution;
    person: Person[];
    program: AcademicProgram[];
    unit: Unit[];
}

const initialEntityAttributes = {
    parentId: null,
    parentType: null,
    relationship: null,
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
        ...initialEntityAttributes,
    }));
};

const fetchPeopleData = async () => {
    return (await (await fetch('people.json')).json()) as Promise<
        PersonDataRaw[]
    >;
};

/* 
    create separate person entity for primary and secondary roles and replace boolean string flags with `true`
*/
const makePerson = (type: 'primary' | 'secondary', person: PersonDataRaw) => {
    const ret = { ...initialEntityAttributes } as any;
    const filterStr = type === 'primary' ? 'secondary' : 'primary';

    getKeys(person).forEach(k => {
        if (!k.startsWith(filterStr)) {
            let p: string = k;
            if (k.startsWith(type)) {
                p = k.replace(`${type}_`, '');
            }
            ret[p as keyof Person] = k.toString().endsWith('_bool')
                ? !!person[k]
                : person[k];
        }
    });

    ret.id = datatype.uuid();
    ret.name = `${ret.first} ${ret.last}`;
    ret.type = 'person';

    return ret as Person;
};

const transformPerson = (person: PersonDataRaw) => [
    person.primary_role ? makePerson('primary', person) : null,
    person.secondary_role ? makePerson('secondary', person) : null,
];

export type Campus = BaseEntity;

export type Division = BaseEntity;

export type Unit = BaseEntity;

export type Institution = BaseEntity;

export type EntityType = keyof EntityDict;

// people should be limited to these roles already
const getPersonRelationship = (role: string): Relationship =>
    role.toLowerCase().includes('professor')
        ? 'professor'
        : 'principal_investigator';

/* mutates program and people entities by adding parent identifiers and splitting people by role */
const linkEntities = (programs: AcademicProgram[], people: Person[]) => {
    const UofT: Institution = {
        id: 1,
        type: 'institution',
        name: 'University of Toronto',
        ...{ ...initialEntityAttributes },
    };

    const campuses: Campus[] = [...new Set(programs.map(u => u.campus))]
        .filter(Boolean)
        .map((d, id) => ({
            name: d,
            id: id + 1,
            parentId: 1,
            parentType: 'institution',
            relationship: 'campus',
            type: 'campus' as const,
        }));

    const divisionMap = groupBy(programs, 'division');

    /* if a division has a campus, associate it, otherwise, associate with uoft generally */
    const divisions = [
        ...new Set(
            programs.map(d => d.division).concat(people.map(d => d.division))
        ),
    ]
        .map((d, i) => ({
            id: i + 1,
            name: d,
            type: 'division' as const,
            parentId: divisionMap[d]
                ? campuses.find(c => divisionMap[d][0].campus! === c.name)!.id
                : UofT.id,
            parentType: divisionMap[d] ? 'campus' : 'institution',
            relationship: 'division',
        }))
        .filter(d => !!d.name && d.parentId) as Division[];

    const allDivisionMap = groupBy(divisions, 'name');

    const units = programs
        .filter(uniqueBy('unit'))
        .map(u => ({ division: u.division, department: u.unit }))
        .concat(
            people
                .filter(uniqueBy('department'))
                .map(p => ({ department: p.department, division: p.division }))
        )
        .filter(uniqueBy('department'))
        .filter(d => allDivisionMap[d.division])
        .map((u, i) => ({
            id: i + 1,
            name: u.department,
            type: 'unit' as const,
            parentId: allDivisionMap[u.division][0].id,
            parentType: 'division',
            relationship: 'unit',
        }))
        .filter(u => !!u.name && u.parentId) as Unit[];

    /* filter out all but PIs and professors and map to departments */
    const departmentMap = people.reduce<{ [key: string]: [Person] }>(
        (acc, curr) => {
            const department = curr.department;

            if (
                curr.role &&
                department &&
                (curr.role.toLowerCase().includes('professor') ||
                    curr.role.toLowerCase().includes('investigator'))
            ) {
                acc[department]
                    ? acc[department].push(curr)
                    : (acc[department] = [curr]);
            }

            return acc;
        },
        {}
    );

    // people data doesn't typically map to programs (e.g., a major), so we'll attach to units instead
    const linkedPeople = units.flatMap(u => {
        //add people to department
        return departmentMap[u.name]
            ? departmentMap[u.name].map(p => ({
                  ...p,
                  parentType: 'unit',
                  parentId: u.id,
                  relationship: getPersonRelationship(p.role),
              }))
            : [];
    }) as Person[];

    // units (departments) are parents of programs -- try linking there first, then division
    // each can have only one parent
    const filteredPrograms = programs
        .map(p => {
            let divisionId: number | undefined;
            const unitId = p.unit
                ? units.find(u => u.name === p.unit)?.id
                : null;
            if (unitId) {
                return {
                    ...p,
                    parentId: unitId,
                    parentType: 'unit',
                    relationship: 'department',
                };
            } else {
                divisionId = divisions.find(d => p.division === d.name)?.id;
            }
            if (divisionId) {
                return {
                    ...p,
                    parentId: divisionId,
                    parentType: 'division',
                    relationship: 'division',
                };
            } else return false;
        })
        .filter(p => !!p && p.parentId) as AcademicProgram[];

    return [
        ...campuses,
        ...divisions,
        ...filteredPrograms,
        ...linkedPeople,
        UofT,
        ...units,
    ];
};
const getModel = async (): Promise<ModelEntity[]> => {
    const peopleData = await fetchPeopleData();
    const people = peopleData
        .flatMap(transformPerson)
        .filter(Boolean) as Person[];

    const programData = await fetchAcademicProgramsData();
    const programs = transformPrograms(programData);

    return linkEntities(programs, people);
};

export type ModelEntity = Unit | Division | Person | AcademicProgram;

export default getModel;
