import React, { useEffect, useMemo, useState } from 'react';
import { Box, useTheme } from '@mui/material';
import { DSINode } from '../../types';
import { getEntityId, makeTree } from '../../util';
import LocalGraph from './ForceGraphLocal';

interface ForceGraphLocalProps {
    tree: DSINode;
    selectedNodeId: string;
    onNodeClick: (node: DSINode) => void;
}

const ForceGraphForceGraphLocalComponent: React.FC<ForceGraphLocalProps> = ({
    onNodeClick,
    selectedNodeId,
    tree,
}) => {
    const [Graph, setGraph] = useState<LocalGraph>();

    const theme = useTheme();

    const root = useMemo(
        () => tree.find(n => getEntityId(n.data) === selectedNodeId)!,
        [selectedNodeId, tree]
    );

    const pruned = useMemo(() => {
        if (root) {
            return root.height
                ? makeTree(
                      root.children!.map(d => d.data).concat(root.data),
                      root.data
                  )
                : makeTree(
                      root
                          .parent!.children!.map(d => d.data)
                          .concat(root.parent!.data),
                      root.parent!.data!
                  );
        }
    }, [root]);

    const targetId = 'local-target';

    /* initialize */
    useEffect(() => {
        if (pruned && !Graph) {
            setGraph(new LocalGraph(targetId, theme, pruned, onNodeClick));
        }
    }, [Graph, onNodeClick, pruned, selectedNodeId, theme]);

    return <Box id={targetId} display="flex" flexGrow={1} />;
};

export default ForceGraphForceGraphLocalComponent;
