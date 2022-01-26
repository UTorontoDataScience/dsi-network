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
    ModelEntity,
    Person,
} from '../types';
import { compose, getEntityId, snakeToSpace } from '../util';

const resolveDetailComponet = (nodes: HierarchyNode<ModelEntity>[]) => {
    if (isProgramNodes(nodes)) {
        return <ProgramDetailCard nodes={nodes} />;
    } else if (isPeopleNodes(nodes)) {
        return <PersonDetailCard nodes={nodes} />;
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
                    {nodes[0].data.research_keywords
                        .split(/[,;]/)
                        .map((d, i) =>
                            i === 0 ? capitalize(d.trim()) : d.trim()
                        )
                        .join(', ')}
                </Typography>
            </>
        )}
    </CardContent>
);

const ProgramDetailCard: React.FC<{
    nodes: HierarchyNode<AcademicProgram>[];
}> = ({ nodes }) => (
    <CardContent>
        <Typography color="primary" variant="h4">
            {nodes[0].data.name}
        </Typography>
        {!!nodes[0].data.unit && <Typography>{nodes[0].data.unit}</Typography>}
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

export default DetailCard;
