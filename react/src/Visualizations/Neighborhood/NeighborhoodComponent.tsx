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

    /* if a leaf was selected, make its parent the central node, so we see siblings */
    const hub = useMemo(() => {
        const selected = tree.find(
            n => getEntityId(n.data) === selectedNodeId
        )!;
        return selected.children ? selected : selected.parent!;
    }, [selectedNodeId, tree]);

    /* build new tree with at least two and at most three generations */
    const neighborhood = useMemo(() => {
        if (hub) {
            const grandparent = hub.parent?.data;
            const parent = hub.data;
            const children = hub.children!.map(d => d.data);

            const newTree = makeTree(
                [parent]
                    .concat(children)
                    .concat(grandparent ? grandparent : []),
                grandparent ? grandparent : parent
            );

            /* replace children with flag, so visualization knows there is additional depth */
            return mapTree(newTree, t => ({
                ...t,
                hasChildren: treeMap[t.id!],
            })) as LocalDSINode;
        }
    }, [hub, treeMap]);

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
            _graph.render(neighborhood, getEntityId(hub.data));
            setChart(_graph);
        } else if (
            neighborhood &&
            Chart &&
            getEntityId(hub.data) != getEntityId(Chart.selectedNode!.data!)
        ) {
            Chart.render(neighborhood, getEntityId(hub.data));
        }
    }, [Chart, resetViewNode, neighborhood, hub, setSelected, theme]);

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
