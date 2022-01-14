import React from 'react';
import { capitalize, Card, CardContent, Typography } from '@mui/material';
import { ModelEntity } from '../data/model';
import { AcademicProgram, isPerson, isProgram, Person } from '../types';

const resolveDetailComponet = (item: ModelEntity[]) => {
    if (isProgram(item[0])) {
        return <ProgramDetailCard program={item[0]} />;
    } else if (isPerson(item[0])) {
        return <PersonDetailCard people={item as Person[]} />;
    } else return <BaseDetailCard entity={item[0]} />;
};

interface DetailCardProps {
    item: ModelEntity[];
}

/* if the same item is in several places, we'll get each record -- name should be identical for each -- we'll want to refine this as models are added */
const DetailCard: React.FC<DetailCardProps> = ({ item }) => {
    return <Card variant="elevation">{resolveDetailComponet(item)}</Card>;
};

const PersonDetailCard: React.FC<{ people: Person[] }> = ({ people }) => (
    <CardContent>
        <Typography color="primary" variant="h4">
            {people[0].name}
        </Typography>
        {!!people[0].email && <Typography>{people[0].email}</Typography>}
        {people.map(l => {
            return (
                <Typography key={l.id}>
                    {capitalize(l.relationship!)}, {/* l.parent.name */}
                </Typography>
            );
        })}
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
