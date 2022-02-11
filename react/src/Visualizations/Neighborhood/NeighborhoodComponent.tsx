import React, { useEffect, useMemo, useState } from 'react';
import { Box, useTheme } from '@mui/material';
import { DSINode, ModelEntity } from '../../types';
import { getEntityId, makeTree, mapTree } from '../../util';
import Neighborhood from './Neighborhood';

export interface LocalDSINode extends DSINode {
    hasChildren?: boolean;
    hasParent?: boolean;
}

interface NeighborhoodProps {
    resetViewNode: (node: LocalDSINode) => void;
    selectedNodeId: string;
    setSelected: (models: ModelEntity[]) => void;
    tree: DSINode;
}

const NeighborhoodComponent: React.FC<NeighborhoodProps> = ({
    resetViewNode,
    selectedNodeId,
    setSelected,
    tree,
}) => {
    const [Chart, setChart] = useState<Neighborhood>();

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
        if (neighborhood && !Chart) {
            const _graph = new Neighborhood(
                resetViewNode,
                targetId,
                setSelected,
                theme
            );
            _graph.render(neighborhood, selectedNodeId);
            setChart(_graph);
        } else if (
            neighborhood &&
            Chart &&
            selectedNodeId != getEntityId(Chart.selectedNode!.data!)
        ) {
            Chart.render(neighborhood, selectedNodeId);
        }
    }, [
        Chart,
        resetViewNode,
        neighborhood,
        selectedNodeId,
        setSelected,
        theme,
    ]);

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

export default NeighborhoodComponent;
