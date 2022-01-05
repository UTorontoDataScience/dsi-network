import { Card, CardContent, Typography } from '@mui/material';
import React from 'react';

interface CardProps {
    affiliations?: string[];
    unit?: string | null;
    email?: string;
    title: string;
}

const DetailCard: React.FC<CardProps> = ({
    affiliations,
    unit,
    email,
    title,
}) => {
    return (
        <Card variant="elevation">
            <CardContent>
                <Typography color="primary" variant="h4">
                    {title}
                </Typography>
                {!!email && <Typography>{email}</Typography>}
                {!!unit && <Typography>{unit}</Typography>}
            </CardContent>
        </Card>
    );
};

export default DetailCard;
