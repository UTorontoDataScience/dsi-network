import { datatype } from 'faker';
import {
    PersonDataRaw,
    Person,
    Relationship,
    Network,
    Institution,
    Division,
    Unit,
    ModelEntity,
} from '../types';
import { getKeys, groupBy, toProperCase, uniqueBy } from '../util/util';

const fetchPeopleData = async () => {
    return (await (await fetch('members-simplified.json')).json()) as Promise<
        PersonDataRaw[]
    >;
};

const baseEntityAttributes = {
    parentId: null,
    parentType: null,
    relationship: null,
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
    ret.name = toProperCase(`${ret.first} ${ret.last}`);
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
        : role.toLowerCase().includes('scientist')
        ? 'scientist'
        : 'principal_investigator';

const linkEntities = (people: Person[]) => {
    const network: Network = {
        name: 'Data Sciences Institute Network',
        id: 1,
        type: 'network',
        ...baseEntityAttributes,
    };

    const institutions: Institution[] = [
        ...new Set(people.map(u => u.institution)),
    ]
        .filter(Boolean)
        .map((d, id) => ({
            name: d.trim(),
            id: id + 1,
            parentId: 1,
            parentType: 'network',
            relationship: 'institution',
            type: 'institution' as const,
        }));

    const UofT = institutions.find(i => i.name === 'University of Toronto')!;

    const _divisionMap = groupBy(
        people.filter(p => !!p.division),
        'division'
    );

    /* if a division has a campus, associate it, otherwise, associate with uoft generally */
    const divisions = [
        ...new Set(
            people.map(d => d.division).concat(people.map(d => d.division))
        ),
    ]
        .map((d, i) => ({
            id: i + 1,
            name: d?.trim(),
            type: 'division' as const,
            parentId: _divisionMap[d]
                ? institutions.find(
                      c => _divisionMap[d][0].institution! === c.name
                  )!.id
                : UofT.id,
            parentType: 'institution',
            relationship: 'division',
        }))
        .filter(d => !!d.name && d.parentId && d.name) as Division[];

    const divisionMap = groupBy(divisions, 'name');

    const units = people
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
            name: u.department?.trim(),
            type: 'unit' as const,
            parentId: divisionMap[u.division][0].id,
            parentType: 'division',
            relationship: 'department',
        })) as Unit[];

    const filteredPeople = people.filter(
        p =>
            (!!p.role &&
                (p.role.toLowerCase().includes('professor') ||
                    p.role.toLowerCase().includes('investigator'))) ||
            p.role.toLowerCase().includes('scientist')
    );

    const unitMap = groupBy(units, 'name');
    const institutionMap = groupBy(institutions, 'name');

    /* attach to parent in order of ascending generality */
    const linkedPeople = filteredPeople
        .map(p => {
            if (unitMap[p.unit]) {
                return {
                    ...p,
                    parentType: 'unit',
                    parentId: unitMap[p.unit][0].id,
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

    return [
        ...divisions,
        ...institutions,
        ...linkedPeople,
        network,
        ...units,
    ].filter(m => m.name !== 'Not Applicable');
};
const getModel = async (): Promise<ModelEntity[]> => {
    const peopleData = await fetchPeopleData();
    const people = peopleData
        .flatMap(transformPerson)
        .filter(Boolean) as Person[];

    return linkEntities(people);
};

export default getModel;
