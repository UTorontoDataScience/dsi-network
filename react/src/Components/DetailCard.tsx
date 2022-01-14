import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { ModelEntity } from '../data/model';
import { AcademicProgram, isPerson, isProgram, Person } from '../types';

const resolveDetailComponet = (item: ModelEntity) => {
    if (isProgram(item)) {
        return <ProgramDetailCard program={item} />;
    } else if (isPerson(item)) {
        return <PersonDetailCard person={item} />;
    } else return <BaseDetailCard entity={item} />;
};

interface DetailCardProps {
    item: ModelEntity;
}

const DetailCard: React.FC<DetailCardProps> = ({ item }) => {
    return <Card variant="elevation">{resolveDetailComponet(item)}</Card>;
};

const PersonDetailCard: React.FC<{ person: Person }> = ({ person }) => (
    <CardContent>
        <Typography color="primary" variant="h4">
            {person.name}
        </Typography>
        {!!person.email && <Typography>{person.email}</Typography>}
        {/* links.map(l => {
            return (
                <Typography key={l.id}>
                    {capitalize(l.relationship)}, {l.parent.name}
                </Typography>
            );
        }) */}
    </CardContent>
);

const ProgramDetailCard: React.FC<{
    program: AcademicProgram;
}> = ({ program }) => (
    <CardContent>
        <Typography color="primary" variant="h4">
            {program.name}
        </Typography>
        {!!program.unit && <Typography>{program.unit}</Typography>}
    </CardContent>
);

const BaseDetailCard: React.FC<{
    entity: ModelEntity;
}> = ({ entity }) => (
    <CardContent>
        <Typography color="primary" variant="h4">
            {entity.name}
        </Typography>
    </CardContent>
);

export default DetailCard;
