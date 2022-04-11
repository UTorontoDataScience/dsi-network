import React from 'react';
import {
    Box,
    capitalize,
    Card,
    CardContent,
    Divider,
    Link,
    Typography,
} from '@mui/material';
import { useTheme } from '@mui/system';
import { HierarchyNode } from 'd3-hierarchy';
import { isPeopleNodes, ModelEntity, Person } from '../types';
import { compose, getEntityId, snakeToSpace } from '../util';

const resolveDetailComponent = (nodes: HierarchyNode<ModelEntity>[]) => {
    if (isPeopleNodes(nodes)) {
        return <PersonDetailCard nodes={nodes} />;
    } else return null;
};

interface DetailCardProps {
    nodes: HierarchyNode<ModelEntity>[];
}

const DetailCard: React.FC<DetailCardProps> = ({ nodes }) => {
    const theme = useTheme();

    return (
        <Card variant="elevation">
            <Box padding={2}>
                <Typography
                    color={theme.palette.mode === 'light' ? 'primary' : 'white'}
                    variant="h4"
                >
                    {nodes[0].data.name}
                </Typography>
                <CardContent sx={{ padding: 0 }}>
                    {resolveDetailComponent(nodes)}
                </CardContent>
            </Box>
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
        {/* right now some of these seem unreliable */}
        {!!nodes[0].data.prof_url && nodes[0].data.prof_url.startsWith('http') && (
            <Link target="_blank" rel="noopener" href={nodes[0].data.prof_url}>
                Professional Site
            </Link>
        )}
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

interface KeywordListProps {
    keywords: string;
    label: string;
}

const KeywordList: React.FC<KeywordListProps> = ({ keywords, label }) => (
    <>
        <Divider sx={{ marginTop: 1, marginBottom: 1 }} />
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
