import React, { useEffect } from 'react';
import { Box, useTheme } from '@mui/material';
import { DSINode } from '../../types';
import D3ForceGraphLocal from './ForceGraphLocal';

interface ForceGraphLocalProps {
    tree: DSINode;
    selectedNodeId: string;
}

const ForceGraphForceGraphLocalComponent: React.FC<ForceGraphLocalProps> = ({
    tree,
    selectedNodeId,
}) => {
    const theme = useTheme();

    const targetId = 'local-target';

    /* initialize */
    useEffect(() => {
        if (tree) {
            new D3ForceGraphLocal(targetId, theme, tree, selectedNodeId);
        }
    }, [selectedNodeId, theme, tree]);

    return <Box id={targetId} display="flex" flexGrow={1} />;
};

export default ForceGraphForceGraphLocalComponent;
