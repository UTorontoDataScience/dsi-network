import { HierarchyNode } from 'd3-hierarchy';
import { EntityType, ModelEntity, Relationship } from './data/model';

export interface BaseEntity {
    id: number;
    name: string;
    type: EntityType;
    parentId: number | null;
    parentType: EntityType | null;
    relationship: Relationship | null;
}

export interface AcademicProgramsDataRaw {
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

export interface AcademicProgram extends AcademicProgramsDataRaw, BaseEntity {
    id: number;
    is_research: boolean;
    is_resource: boolean;
    is_education: boolean;
    name: string;
}

export interface PersonDataRaw {
    first: string;
    last: string;
    designation: string;
    email: string;
    unnamed: string;
    primary_institution: string;
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
    ov1: string;
    ov2: string;
    ov3: string;
    ov4: string;
    ov5: string;
    ov6: string;
    ov7: string;
    ov8: string;
    ov9: string;
    ov10: string;
    ov11: string;
    secondary_field: string;
    secondary_level: string;
    secondary_capacity: string;
    secondary_capacity_other: string;
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
    research_data_generated_by_our_lab_bool: string;
    research_data_simulated_bool: string;
    research_data_from_collaborators_bool: string;
    research_data_publicly_avail_with_dta_bool: string;
    research_data_publicly_avail_no_dta_bool: string;
    research_data_write_in_1: string;
    research_data_na_bool: string;
    research_data_write_in_2: string;
    hpc_compute_canada_bool: string;
    hpc_rits_bool: string;
    hpc_hpc4health_bool: string;
    hpc_local_bool: string;
    hpc_private_cloud_bool: string;
    hpc_scfi_bool: string;
    hpc_scinet_bool: string;
    hpc_uoftdiv_bool: string;
    hpc_other_bool: string;
    hpc_na_bool: string;
    hpc_other: string;
    contact_consent_bool: string;
    main_funding_research_ctc_bool: string;
    main_funding_research_other_canadian_bool: string;
    main_funding_research_ontario_bool: string;
    main_funding_research_private_bool: string;
    main_funding_research_usa_bool: string;
    main_funding_research_all_of_the_above_bool: string;
    main_funding_research_other_bool: string;
    main_funding_research_na_bool: string;
    main_funding_research_ctc_cihr_bool: string;
    main_funding_research_ctc_nserc_bool: string;
    main_funding_research_ctc_sshrc_bool: string;
    main_funding_research_ca_other_cca_bool: string;
    main_funding_research_ca_other_crc_bool: string;
    main_funding_research_ca_other_cfi_bool: string;
    main_funding_research_ca_other_cfre_bool: string;
    main_funding_research_ca_other_nren_bool: string;
    main_funding_research_ca_other_bool: string;
    main_funding_research_ca_other_canarie_bool: string;
    main_funding_research_ca_other_hsc_bool: string;
    main_funding_research_ca_other_isedc_bool: string;
    main_funding_research_ca_other_idrc_bool: string;
    main_funding_research_ca_other_mitacs_bool: string;
    main_funding_research_ca_other_ncec_bool: string;
    main_funding_research_ca_other_write_in_1: string;
    main_funding_research_ca_other_write_in_2: string;
    main_funding_research_ontario_cco_bool: string;
    main_funding_research_ontario_era_bool: string;
    main_funding_research_ontario_mohltc_bool: string;
    main_funding_research_ontario_orfre_bool: string;
    main_funding_research_ontario_write_in_1: string;
    main_funding_research_ontario_write_in_2: string;
    main_funding_research_private_hsf_bool: string;
    main_funding_research_private_ccsr_bool: string;
    main_funding_research_private_crs_bool: string;
    main_funding_research_private_write_in_1: string;
    main_funding_research_private_write_in_2: string;
    main_funding_research_usa_nih_bool: string;
    main_funding_research_usa_nsf_bool: string;
    main_funding_research_usa_simons_bool: string;
    main_funding_research_usa_write_in_1: string;
    main_funding_research_usa_write_in_2: string;
    main_funding_research_other: string;
    main_funding_position_ut_bool: string;
    main_funding_position_ctc_bool: string;
    main_funding_position_ctc_gspd_bool: string;
    main_funding_position_can_other_bool: string;
    main_funding_position_ontario_bool: string;
    main_funding_position_private_bool: string;
    main_funding_position_other_bool: string;
    main_funding_position_all_of_the_above_bool: string;
    main_funding_position_na_bool: string;
    main_funding_position_ut_fac_specific_boo: string;
    main_funding_position_ut_ogs_bool: string;
    main_funding_position_ut_sgs_el_bool: string;
    main_funding_position_ut_write_in_1: string;
    main_funding_position_ut_write_in_2: string;
    main_funding_position_ctc_cihr_bool: string;
    main_funding_position_ctc_nserc_bool: string;
    main_funding_position_ctc_sshrc_bool: string;
    main_funding_position_ctc_vanier_bool: string;
    main_funding_position_ctc_write_in_1: string;
    main_funding_position_ctc_write_in_2: string;
    main_funding_research_other_csgl_bool: string;
    main_funding_position_other_mitacs_bool: string;
    main_funding_position_other_all_of_the_above_bool: string;
    main_funding_position_other_write_in_1: string;
    main_funding_position_other_write_in_2: string;
    main_funding_position_ontario_osap_bool: string;
    main_funding_position_ontario_eap_bool: string;
    main_funding_position_ontario_write_in_1: string;
    main_funding_position_ontario_write_in_2: string;
    main_funding_position_private_hsf_bool: string;
    main_funding_position_private_ccsri_bool: string;
    main_funding_position_private_crs_bool: string;
    main_funding_position_private_write_in_1: string;
    main_funding_position_private_write_in_2: string;
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
    research_data_generated_by_our_lab_bool: boolean;
    research_data_simulated_bool: boolean;
    research_data_from_collaborators_bool: boolean;
    research_data_publicly_avail_with_dta_bool: boolean;
    research_data_publicly_avail_no_dta_bool: boolean;
    research_data_write_in_1: string;
    research_data_na_bool: boolean;
    research_data_write_in_2: string;
    hpc_compute_canada_bool: boolean;
    hpc_rits_bool: boolean;
    hpc_hpc4health_bool: boolean;
    hpc_local_bool: boolean;
    hpc_private_cloud_bool: boolean;
    hpc_scfi_bool: boolean;
    hpc_scinet_bool: boolean;
    hpc_uoftdiv_bool: boolean;
    hpc_other_bool: boolean;
    hpc_na_bool: boolean;
    hpc_other: string;
    contact_consent_bool: boolean;
    main_funding_research_ctc_bool: boolean;
    main_funding_research_other_canadian_bool: boolean;
    main_funding_research_ontario_bool: boolean;
    main_funding_research_private_bool: boolean;
    main_funding_research_usa_bool: boolean;
    main_funding_research_all_of_the_above_bool: boolean;
    main_funding_research_other_bool: boolean;
    main_funding_research_na_bool: boolean;
    main_funding_research_ctc_cihr_bool: boolean;
    main_funding_research_ctc_nserc_bool: boolean;
    main_funding_research_ctc_sshrc_bool: boolean;
    main_funding_research_ca_other_cca_bool: boolean;
    main_funding_research_ca_other_crc_bool: boolean;
    main_funding_research_ca_other_cfi_bool: boolean;
    main_funding_research_ca_other_cfre_bool: boolean;
    main_funding_research_ca_other_nren_bool: boolean;
    main_funding_research_ca_other_bool: boolean;
    main_funding_research_ca_other_canarie_bool: boolean;
    main_funding_research_ca_other_hsc_bool: boolean;
    main_funding_research_ca_other_isedc_bool: boolean;
    main_funding_research_ca_other_idrc_bool: boolean;
    main_funding_research_ca_other_mitacs_bool: boolean;
    main_funding_research_ca_other_ncec_bool: boolean;
    main_funding_research_ca_other_write_in_1: string;
    main_funding_research_ca_other_write_in_2: string;
    main_funding_research_ontario_cco_bool: boolean;
    main_funding_research_ontario_era_bool: boolean;
    main_funding_research_ontario_mohltc_bool: boolean;
    main_funding_research_ontario_orfre_bool: boolean;
    main_funding_research_ontario_write_in_1: string;
    main_funding_research_ontario_write_in_2: string;
    main_funding_research_private_hsf_bool: boolean;
    main_funding_research_private_ccsr_bool: boolean;
    main_funding_research_private_crs_bool: boolean;
    main_funding_research_private_write_in_1: string;
    main_funding_research_private_write_in_2: string;
    main_funding_research_usa_nih_bool: boolean;
    main_funding_research_usa_nsf_bool: boolean;
    main_funding_research_usa_simons_bool: boolean;
    main_funding_research_usa_write_in_1: string;
    main_funding_research_usa_write_in_2: string;
    main_funding_research_other: string;
    main_funding_position_ut_bool: boolean;
    main_funding_position_ctc_bool: boolean;
    main_funding_position_ctc_gspd_bool: boolean;
    main_funding_position_can_other_bool: boolean;
    main_funding_position_ontario_bool: boolean;
    main_funding_position_private_bool: boolean;
    main_funding_position_other_bool: boolean;
    main_funding_position_all_of_the_above_bool: boolean;
    main_funding_position_na_bool: boolean;
    main_funding_position_ut_fac_specific_boo: string;
    main_funding_position_ut_ogs_bool: boolean;
    main_funding_position_ut_sgs_el_bool: boolean;
    main_funding_position_ut_write_in_1: string;
    main_funding_position_ut_write_in_2: string;
    main_funding_position_ctc_cihr_bool: boolean;
    main_funding_position_ctc_nserc_bool: boolean;
    main_funding_position_ctc_sshrc_bool: boolean;
    main_funding_position_ctc_vanier_bool: boolean;
    main_funding_position_ctc_write_in_1: string;
    main_funding_position_ctc_write_in_2: string;
    main_funding_research_other_csgl_bool: boolean;
    main_funding_position_other_mitacs_bool: boolean;
    main_funding_position_other_all_of_the_above_bool: boolean;
    main_funding_position_other_write_in_1: string;
    main_funding_position_other_write_in_2: string;
    main_funding_position_ontario_osap_bool: boolean;
    main_funding_position_ontario_eap_bool: boolean;
    main_funding_position_ontario_write_in_1: string;
    main_funding_position_ontario_write_in_2: string;
    main_funding_position_private_hsf_bool: boolean;
    main_funding_position_private_ccsri_bool: boolean;
    main_funding_position_private_crs_bool: boolean;
    main_funding_position_private_write_in_1: string;
    main_funding_position_private_write_in_2: string;
}

export interface DSINode
    extends Record<string, any>,
        HierarchyNode<ModelEntity> {
    selected?: boolean;
}

/* typeguards for Person and Program */

export const isPerson = (person: Person | ModelEntity): person is Person =>
    !!(person as Person).role;

export const isPeopleNodes = (
    people: HierarchyNode<Person>[] | HierarchyNode<ModelEntity>[]
): people is HierarchyNode<Person>[] => isPerson(people[0].data);

export const isProgram = (
    program: AcademicProgram | ModelEntity
): program is AcademicProgram =>
    !!(program as AcademicProgram).degree_designation;

export const isProgramNodes = (
    programs: HierarchyNode<AcademicProgram>[] | HierarchyNode<ModelEntity>[]
): programs is HierarchyNode<AcademicProgram>[] => isProgram(programs[0].data);
