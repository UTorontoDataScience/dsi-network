import React, { useEffect, useState } from 'react';
import { Box, useTheme } from '@mui/material';
import { HierarchyNode } from 'd3-hierarchy';
import { selectAll } from 'd3-selection';
import { DSINode, EntityType, ModelEntity } from '../../types';
import { getEntityId } from '../../util';
import D3ForceGraph from './ForceGraph';

export interface SelectedModel {
    type: EntityType;
    id: number;
}
interface ForceGraphProps {
    containerWidth: number;
    tree: HierarchyNode<ModelEntity>;
    selectedCallback: (node: DSINode) => void;
}

const ForceGraph: React.FC<ForceGraphProps> = ({
    containerWidth,
    tree,
    selectedCallback,
}) => {
    const [Graph, setGraph] = useState<D3ForceGraph>();

    const theme = useTheme();

    const targetId = 'target';

    /* initialize */
    useEffect(() => {
        if (tree && !Graph && containerWidth) {
            const Graph = new D3ForceGraph(
                targetId,
                theme,
                tree,
                selectedCallback
            );
            Graph.render();
            setGraph(Graph);
        }
    }, [Graph, containerWidth, tree, selectedCallback, theme]);

    /* toggle dark mode */
    useEffect(() => {
        if (Graph) {
            Graph.toggleTheme(theme);
        }
    }, [theme, Graph]);

    /* replace graphic entirely when root changes */
    useEffect(() => {
        if (Graph && getEntityId(Graph.tree.data) !== getEntityId(tree.data)) {
            selectAll('svg').remove();

            const Graph = new D3ForceGraph(
                targetId,
                theme,
                tree,
                selectedCallback
            );
            Graph.render();
            setGraph(Graph);
        } else {
            Graph?.update(tree);
        }
        /* eslint-disable-next-line react-hooks/exhaustive-deps */
    }, [tree]);

    return containerWidth ? (
        <Box width={`${containerWidth}px`} id={targetId} />
    ) : null;
};

export default ForceGraph;
