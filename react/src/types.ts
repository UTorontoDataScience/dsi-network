import { SimulationNodeDatum } from 'd3-force';
import { HierarchyNode } from 'd3-hierarchy';

export interface BaseEntity {
    id: number;
    name: string;
    type: EntityType;
    parentId: number | null;
    parentType: EntityType | null;
    relationship: Relationship | null;
}

export interface PersonDataRaw {
    first: string;
    last: string;
    designation: string;
    email: string;
    unnamed: string;
    primary_institution: string;
    primary_unit: string;
    primary_role: string;
    primary_division: string;
    primary_department: string;
    primary_field: string;
    primary_level: string;
    primary_capacity: string;
    primary_capacity_other: string;
    secondary_apt_bool: string;
    secondary_apt: string;
    secondary_details: string;
    secondary_institution: string;
    secondary_other: string;
    secondary_role: string;
    secondary_division: string;
    secondary_department: string;
    secondary_field: string;
    secondary_level: string;
    secondary_capacity: string;
    secondary_capacity_other: string;
    research_main: string;
    research_main_other: string;
    hum_soc_dep: string;
    hum_soc_concentration: string;
    nat_eng_dep: string;
    nat_eng_concentration: string;
    life_sci_field: string;
    life_sci_concentration: string;
    expertise_other: string;
    main_research_applications: string;
    research_keywords: string;
    prof_url: string;
    google_scholar_url: string;
}

export interface Person extends BaseEntity {
    first: string;
    last: string;
    designation: string;
    email: string;
    name: string;
    unnamed: string;
    id: number;
    institution: string;
    role: string;
    division: string;
    department: string;
    field: string;
    unit: string;
    level: string;
    capacity: string;
    capacity_other: string;
    unnamed_2: string;
    research_main: string;
    research_main_other: string;
    hum_soc_dep: string;
    hum_soc_concentration: string;
    nat_eng_dep: string;
    nat_eng_concentration: string;
    life_sci_field: string;
    life_sci_concentration: string;
    expertise_other: string;
    main_research_applications: string;
    research_keywords: string;
    prof_url: string;
    google_scholar_url: string;
}

export type Relationship =
    | 'affiliate'
    | 'department'
    | 'campus'
    | 'division'
    | 'fellow'
    | 'graduate_student'
    | 'grantee'
    | 'institution'
    | 'postdoc'
    | 'principal_investigator'
    | 'professor'
    | 'program'
    | 'researcher'
    | 'resource'
    | 'scientist'
    | 'staff'
    | 'support'
    | 'undergraduate';

export type Campus = BaseEntity;

export type Division = BaseEntity;

export type Unit = BaseEntity;

export type Institution = BaseEntity;

export type Network = BaseEntity;

export type EntityType = keyof EntityDict;

export type AcademicProgram = BaseEntity;

export type Resource = BaseEntity;

export interface EntityDict {
    campus: Campus[];
    division: Division[];
    institution: Institution[];
    network: Network[];
    person: Person[];
    program: AcademicProgram[];
    resource: Resource[];
    unit: Unit[];
}

export type ModelEntity = Unit | Division | Person | AcademicProgram;

export interface DSINode
    extends Record<string, any>,
        HierarchyNode<ModelEntity>,
        SimulationNodeDatum {
    selected?: boolean;
}

/* typeguards for Person and Program */

export const isPerson = (person: Person | ModelEntity): person is Person =>
    'role' in (person as Person);

export const isPeopleNodes = (
    people: HierarchyNode<Person>[] | HierarchyNode<ModelEntity>[]
): people is HierarchyNode<Person>[] => isPerson(people[0].data);

export const isProgram = (
    program: AcademicProgram | ModelEntity
): program is AcademicProgram =>
    'degree_designation' in (program as AcademicProgram);

export const isProgramNodes = (
    programs: HierarchyNode<AcademicProgram>[] | HierarchyNode<ModelEntity>[]
): programs is HierarchyNode<AcademicProgram>[] => isProgram(programs[0].data);

export const isResource = (
    resource: Resource | ModelEntity
): resource is Resource => 'user_fee' in (resource as Resource);

export const isResourceNodes = (
    resources: HierarchyNode<Resource>[] | HierarchyNode<ModelEntity>[]
): resources is HierarchyNode<Resource>[] => isResource(resources[0].data);
