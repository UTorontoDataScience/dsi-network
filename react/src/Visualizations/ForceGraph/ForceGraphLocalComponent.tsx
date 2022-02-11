import React, { useEffect, useMemo, useState } from 'react';
import { Box, useTheme } from '@mui/material';
import { DSINode } from '../../types';
import { getEntityId, makeTree, mapTree } from '../../util';
import LocalGraph from './ForceGraphLocal';

export interface LocalDSINode extends DSINode {
    hasChildren?: boolean;
    hasParent?: boolean;
}

interface ForceGraphLocalProps {
    tree: DSINode;
    selectedNodeId: string;
    resetViewNode: (node: LocalDSINode) => void;
}

const ForceGraphForceGraphLocalComponent: React.FC<ForceGraphLocalProps> = ({
    resetViewNode,
    selectedNodeId,
    tree,
}) => {
    const [Graph, setGraph] = useState<LocalGraph>();

    const theme = useTheme();

    const treeMap = useMemo(() => {
        return tree.descendants().reduce<Record<string, boolean>>(
            (acc, curr) => ({
                ...acc,
                [getEntityId(curr.data)]: !!curr.children,
            }),
            {}
        );
    }, [tree]);

    const root = useMemo(
        () => tree.find(n => getEntityId(n.data) === selectedNodeId)!,
        [selectedNodeId, tree]
    );

    const neighborhood = useMemo(() => {
        if (root) {
            const parent = root?.parent?.data || [];
            const children = (root.children || []).map(d => d.data);

            const neighborhood = makeTree(
                [root.data].concat(parent).concat(children),
                root?.parent?.data || root.data
            );

            /* replace children with flag, so visualization knows there is additional depth */
            return mapTree(neighborhood, t => ({
                ...t,
                hasChildren: treeMap[t.id!],
            })) as LocalDSINode;
        }
    }, [root, treeMap]);

    const targetId = 'local-target';

    /* initialize/update */
    useEffect(() => {
        if (neighborhood && !Graph) {
            const _graph = new LocalGraph(targetId, theme, resetViewNode);
            _graph.render(neighborhood, selectedNodeId);
            setGraph(_graph);
        } else if (
            neighborhood &&
            Graph &&
            selectedNodeId != Graph.selectedNode?.id
        ) {
            Graph.render(neighborhood, selectedNodeId);
        }
    }, [Graph, resetViewNode, neighborhood, selectedNodeId, theme]);

    return (
        <Box
            id={targetId}
            display="flex"
            justifyContent="center"
            width="100%"
            height="100%"
        />
    );
};

export default ForceGraphForceGraphLocalComponent;
