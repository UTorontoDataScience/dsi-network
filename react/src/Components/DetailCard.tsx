import React from 'react';
import { capitalize, Card, CardContent, Typography } from '@mui/material';
import { HierarchyNode } from 'd3-hierarchy';
import {
    AcademicProgram,
    isPeopleNodes,
    isProgramNodes,
    ModelEntity,
    Person,
} from '../types';

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
        {!!nodes[0].data.email && (
            <Typography>{nodes[0].data.email}</Typography>
        )}
        {nodes.map(l => {
            return (
                <Typography key={l.data.name}>
                    {capitalize(l.data.relationship!)},{' '}
                    {l.parent && l.parent.data.name}
                </Typography>
            );
        })}
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
