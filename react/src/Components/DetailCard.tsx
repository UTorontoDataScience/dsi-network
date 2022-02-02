import React from 'react';
import {
    Box,
    capitalize,
    Card,
    CardContent,
    Divider,
    Typography,
} from '@mui/material';
import { HierarchyNode } from 'd3-hierarchy';
import {
    AcademicProgram,
    isPeopleNodes,
    isProgramNodes,
    isResourceNodes,
    ModelEntity,
    Person,
    Resource,
} from '../types';
import { compose, getEntityId, snakeToSpace } from '../util';

const resolveDetailComponent = (nodes: HierarchyNode<ModelEntity>[]) => {
    if (isProgramNodes(nodes)) {
        return <ProgramDetailCard nodes={nodes} />;
    } else if (isPeopleNodes(nodes)) {
        return <PersonDetailCard nodes={nodes} />;
    } else if (isResourceNodes(nodes)) {
        return <ResourceDetailCard nodes={nodes} />;
    } else return null;
};

interface DetailCardProps {
    nodes: HierarchyNode<ModelEntity>[];
}

const DetailCard: React.FC<DetailCardProps> = ({ nodes }) => {
    return (
        <Card variant="elevation">
            <Typography color="primary" variant="h4">
                {nodes[0].data.name}
            </Typography>
            <CardContent>{resolveDetailComponent(nodes)}</CardContent>
        </Card>
    );
};

const PersonDetailCard: React.FC<{ nodes: HierarchyNode<Person>[] }> = ({
    nodes,
}) => (
    <>
        {nodes.map(l => {
            return (
                <Typography key={getEntityId(l.data)}>
                    {compose(capitalize, snakeToSpace)(l.data.relationship!)},{' '}
                    {l.parent && l.parent.data.name}
                </Typography>
            );
        })}
        {!!nodes[0].data.email && (
            <Typography>{nodes[0].data.email}</Typography>
        )}
        {!!nodes[0].data.research_keywords && (
            <KeywordList
                keywords={nodes[0].data.research_keywords}
                label="Research Interests"
            />
        )}
    </>
);

const ProgramDetailCard: React.FC<{
    nodes: HierarchyNode<AcademicProgram>[];
}> = ({ nodes }) => (
    <>
        {!!nodes[0].data.unit && <Typography>{nodes[0].data.unit}</Typography>}
        {!!nodes[0].data.short_description && (
            <Typography variant="caption">
                {nodes[0].data.short_description}
            </Typography>
        )}
        {!!nodes[0].data.key_words_tags && (
            <KeywordList
                keywords={nodes[0].data.key_words_tags}
                label="Keywords"
            />
        )}
    </>
);

const ResourceDetailCard: React.FC<{
    nodes: HierarchyNode<Resource>[];
}> = ({ nodes }) => (
    <>
        {!!nodes[0].data.institution && (
            <Typography>{nodes[0].data.institution}</Typography>
        )}
        {!!(nodes[0].data.keywords || '').trim() && (
            <KeywordList keywords={nodes[0].data.keywords} label="Keywords" />
        )}
    </>
);

interface KeywordListProps {
    keywords: string;
    label: string;
}

const KeywordList: React.FC<KeywordListProps> = ({ keywords, label }) => (
    <>
        <Divider />
        <Typography variant="caption">
            <Box component="span" fontWeight="bold">
                {label}:{' '}
            </Box>
            <Box component="span">
                {keywords
                    .split(/[,;]/)
                    .map((d, i) => (i === 0 ? capitalize(d.trim()) : d.trim()))
                    .join(', ')}
            </Box>
        </Typography>
    </>
);

export default DetailCard;
