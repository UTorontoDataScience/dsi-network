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

const resolveDetailComponet = (nodes: HierarchyNode<ModelEntity>[]) => {
    if (isProgramNodes(nodes)) {
        return <ProgramDetailCard nodes={nodes} />;
    } else if (isPeopleNodes(nodes)) {
        return <PersonDetailCard nodes={nodes} />;
    } else if (isResourceNodes(nodes)) {
        return <ResourceDetailCard nodes={nodes} />;
    } else return <BaseDetailCard nodes={nodes} />;
};

interface DetailCardProps {
    nodes: HierarchyNode<ModelEntity>[];
}

/* if the same item is in several places, we'll get each record -- name should be identical for each -- we'll want to refine this as models are added */
const DetailCard: React.FC<DetailCardProps> = ({ nodes }) => {
    return <Card variant="elevation">{resolveDetailComponet(nodes)}</Card>;
};

const PersonDetailCard: React.FC<{ nodes: HierarchyNode<Person>[] }> = ({
    nodes,
}) => (
    <CardContent>
        <Typography color="primary" variant="h4">
            {nodes[0].data.name}
        </Typography>
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
            <>
                <Divider />
                <Typography variant="caption">
                    <Box component="span" fontWeight="bold">
                        Research Interests:{' '}
                    </Box>
                    <KeywordList keywords={nodes[0].data.research_keywords} />
                </Typography>
            </>
        )}
    </CardContent>
);

const ProgramDetailCard: React.FC<{
    nodes: HierarchyNode<AcademicProgram>[];
}> = ({ nodes }) => (
    <CardContent>
        <Typography color="primary" variant="h5">
            {nodes[0].data.name}
        </Typography>
        {!!nodes[0].data.unit && <Typography>{nodes[0].data.unit}</Typography>}
        {!!nodes[0].data.short_description && (
            <Typography variant="caption">
                {nodes[0].data.short_description}
            </Typography>
        )}
        {!!nodes[0].data.key_words_tags && (
            <>
                <Divider />
                <Typography variant="caption">
                    <Box component="span" fontWeight="bold">
                        Keywords:{' '}
                    </Box>
                    <KeywordList keywords={nodes[0].data.key_words_tags} />
                </Typography>
            </>
        )}
    </CardContent>
);

const ResourceDetailCard: React.FC<{
    nodes: HierarchyNode<Resource>[];
}> = ({ nodes }) => (
    <CardContent>
        <Typography color="primary" variant="h5">
            {nodes[0].data.name}
        </Typography>
        {!!nodes[0].data.institution && (
            <Typography>{nodes[0].data.institution}</Typography>
        )}
        {!!(nodes[0].data.keywords || '').trim() && (
            <>
                <Divider />
                <Typography variant="caption">
                    <Box component="span" fontWeight="bold">
                        Keywords:{' '}
                    </Box>
                    <KeywordList keywords={nodes[0].data.keywords} />
                </Typography>
            </>
        )}
    </CardContent>
);

const BaseDetailCard: React.FC<{
    nodes: HierarchyNode<ModelEntity>[];
}> = ({ nodes }) => (
    <CardContent>
        <Typography color="primary" variant="h4">
            {nodes[0].data.name}
        </Typography>
    </CardContent>
);

interface KeywordListProps {
    keywords: string;
}

const KeywordList: React.FC<KeywordListProps> = ({ keywords }) => (
    <Box component="span">
        {keywords
            .split(/[,;]/)
            .map((d, i) => (i === 0 ? capitalize(d.trim()) : d.trim()))
            .join(', ')}
    </Box>
);

export default DetailCard;
