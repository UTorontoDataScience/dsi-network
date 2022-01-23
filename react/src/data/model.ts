import { datatype } from 'faker';
import {
    AcademicProgram,
    AcademicProgramsDataRaw,
    PersonDataRaw,
    Person,
    Resource,
    Relationship,
    Network,
    Institution,
    Campus,
    Division,
    Unit,
    ModelEntity,
} from '../types';
import { getKeys, groupBy, uniqueBy } from '../util/util';

const fetchAcademicProgramsData = async () => {
    return (await (await fetch('academic-programs.json')).json()) as Promise<
        AcademicProgramsDataRaw[]
    >;
};

const fetchPeopleData = async () => {
    return (await (await fetch('people.json')).json()) as Promise<
        PersonDataRaw[]
    >;
};

const fetchResourceData = async () => {
    return (await (await fetch('resource.json')).json()) as Promise<Resource[]>;
};

const baseEntityAttributes = {
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
        ...baseEntityAttributes,
    }));
};

/* 
    create separate person entity for primary and secondary roles and replace boolean string flags with `true`
*/
const makePerson = (type: 'primary' | 'secondary', person: PersonDataRaw) => {
    const ret = { ...baseEntityAttributes } as any;
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

const getPersonRelationship = (role: string): Relationship =>
    role.toLowerCase().includes('professor')
        ? 'professor'
        : 'principal_investigator';

/*  add parent identifiers and split person entries by role */
const linkEntities = (
    programs: AcademicProgram[],
    people: Person[],
    resources: Resource[]
) => {
    const network: Network = {
        name: 'Data Science Network',
        id: 1,
        type: 'network',
        ...baseEntityAttributes,
    };

    const institutions: Institution[] = [
        ...new Set(people.map(u => u.institution)),
    ]
        .filter(Boolean)
        .map((d, id) => ({
            name: d,
            id: id + 1,
            parentId: 1,
            parentType: 'network',
            relationship: 'institution',
            type: 'institution' as const,
        }));

    const UofT = institutions.find(i => i.name === 'University of Toronto')!;

    const campuses: Campus[] = [...new Set(programs.map(u => u.campus))]
        .filter(Boolean)
        .map((d, id) => ({
            name: d,
            id: id + 1,
            parentId: UofT.id,
            parentType: 'institution',
            relationship: 'campus',
            type: 'campus' as const,
        }));

    const _divisionMap = groupBy(
        programs.filter(p => !!p.division),
        'division'
    );

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
            parentId: _divisionMap[d]
                ? campuses.find(c => _divisionMap[d][0].campus! === c.name)!.id
                : UofT.id,
            parentType: _divisionMap[d] ? 'campus' : 'institution',
            relationship: 'division',
        }))
        .filter(d => !!d.name && d.parentId && d.name) as Division[];

    const divisionMap = groupBy(divisions, 'name');

    const units = programs
        .filter(uniqueBy('unit'))
        .map(u => ({ division: u.division, department: u.unit }))
        .concat(
            people
                .filter(uniqueBy('department'))
                .map(p => ({ department: p.department, division: p.division }))
        )
        .filter(uniqueBy('department'))
        .filter(
            d =>
                !!d.department &&
                divisionMap[d.division] &&
                d.department !== 'Not Applicable'
        )
        .map((u, i) => ({
            id: i + 1,
            name: u.department,
            type: 'unit' as const,
            parentId: divisionMap[u.division][0].id,
            parentType: 'division',
            relationship: 'department',
        })) as Unit[];

    const filteredPeople = people.filter(
        p =>
            !!p.role &&
            (p.role.toLowerCase().includes('professor') ||
                p.role.toLowerCase().includes('investigator'))
    );

    const unitMap = groupBy(units, 'name');
    const institutionMap = groupBy(institutions, 'name');

    /* attach to parent in order of ascending generality */
    const linkedPeople = filteredPeople
        .map(p => {
            if (unitMap[p.department]) {
                return {
                    ...p,
                    parentType: 'unit',
                    parentId: unitMap[p.department][0].id,
                    relationship: getPersonRelationship(p.role),
                };
            } else if (divisionMap[p.division]) {
                return {
                    ...p,
                    parentType: 'division',
                    parentId: divisionMap[p.division][0].id,
                    relationship: getPersonRelationship(p.role),
                };
            } else if (institutionMap[p.institution]) {
                return {
                    ...p,
                    parentType: 'institution',
                    parentId: institutionMap[p.institution][0].id,
                    relationship: getPersonRelationship(p.role),
                };
            } else return null;
        })
        .filter(Boolean) as Person[];

    // units (departments) are parents of programs -- try linking there first, then division
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

    /* for the time being we won't use resource institutions to make top-level entries but will only link to existing */
    const resource = resources
        .map((r, i) => {
            if (divisionMap[r.division]) {
                return {
                    ...r,
                    id: i + 1,
                    type: 'resource',
                    parentId: divisionMap[r.division][0].id,
                    parentType: 'division',
                    relationship: 'resource',
                };
            } else if (institutionMap[r.institution]) {
                return {
                    ...r,
                    id: i + 1,
                    type: 'resource',
                    parentId: institutionMap[r.institution][0].id,
                    parentType: 'institution',
                    relationship: 'resource',
                };
            } else return null;
        })
        .filter(Boolean) as Resource[];

    return [
        ...campuses,
        ...divisions,
        ...filteredPrograms,
        ...institutions,
        ...linkedPeople,
        network,
        ...resource,
        ...units,
    ];
};
const getModel = async (): Promise<ModelEntity[]> => {
    const peopleData = await fetchPeopleData();
    const people = peopleData
        .flatMap(transformPerson)
        .filter(Boolean) as Person[];

    const programData = await fetchAcademicProgramsData();
    const resources = await fetchResourceData();
    const programs = transformPrograms(programData);

    return linkEntities(programs, people, resources);
};

export default getModel;
