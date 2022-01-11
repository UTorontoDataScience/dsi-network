import { capitalize, Card, CardContent, Typography } from '@mui/material';
import React from 'react';
import { HydratedLink, ModelEntity } from '../data/model';
import {
    AcademicProgram,
    EntityWithLinks,
    isPerson,
    isProgram,
    Person,
} from '../types';

const resolveDetailComponet = (item: EntityWithLinks) => {
    if (isProgram(item.entity)) {
        return <ProgramDetailCard program={item.entity} links={item.links} />;
    } else if (isPerson(item.entity)) {
        return <PersonDetailCard person={item.entity} links={item.links} />;
    } else return null;
};

interface DetailCardProps {
    item: EntityWithLinks;
}

const DetailCard: React.FC<DetailCardProps> = ({ item }) => {
    return <Card variant="elevation">{resolveDetailComponet(item)}</Card>;
};

const PersonDetailCard: React.FC<{ person: Person; links: HydratedLink[] }> = ({
    person,
    links,
}) => (
    <CardContent>
        <Typography color="primary" variant="h4">
            {person.name}
        </Typography>
        {!!person.email && <Typography>{person.email}</Typography>}
        {links.map(l => {
            return (
                <Typography key={l.id}>
                    {capitalize(l.relationship)}, {l.parent.name}
                </Typography>
            );
        })}
    </CardContent>
);

const ProgramDetailCard: React.FC<{
    program: AcademicProgram;
    links: HydratedLink[];
}> = ({ program }) => (
    <CardContent>
        <Typography color="primary" variant="h4">
            {program.name}
        </Typography>
        {!!program.unit && <Typography>{program.unit}</Typography>}
    </CardContent>
);

export default DetailCard;
