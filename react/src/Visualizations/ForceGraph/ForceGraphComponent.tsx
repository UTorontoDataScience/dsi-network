import React, { useEffect, useState } from 'react';
import { Box, useTheme } from '@mui/material';
import { HierarchyNode } from 'd3-hierarchy';
import { DSINode, EntityType, ModelEntity } from '../../types';
import { getEntityId } from '../../util';
import D3ForceGraph from './ForceGraph';

export interface SelectedModel {
    id: number;
    type: EntityType;
}
interface ForceGraphProps {
    containerWidth: number;
    onBackgroundClick: () => void;
    onNodeClick: (node: DSINode, resetZoom: () => void) => void;
    tree: HierarchyNode<ModelEntity>;
}

const ForceGraph: React.FC<ForceGraphProps> = ({
    containerWidth,
    onBackgroundClick,
    onNodeClick,
    tree,
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
                onBackgroundClick,
                onNodeClick
            );
            Graph.render();
            setGraph(Graph);
        }
    }, [containerWidth, Graph, onBackgroundClick, onNodeClick, tree, theme]);

    /* toggle dark mode */
    useEffect(() => {
        if (Graph) {
            Graph.toggleTheme(theme);
        }
    }, [theme, Graph]);

    /* 
        D3 isn't in the React tree and doesn't know when props change,
          so we'll manually update to keep things in sync
    */
    useEffect(() => {
        if (Graph && Graph.onNodeClick !== onNodeClick) {
            Graph.onNodeClick = onNodeClick;
        }
    }, [Graph, onNodeClick]);

    useEffect(() => {
        /* replace graphic entirely when root changes */
        if (Graph && getEntityId(Graph.tree.data) !== getEntityId(tree.data)) {
            Graph.remove();
            Graph.tree = tree;
            Graph.render();
        } else if (Graph) {
            Graph.update(tree);
        }
        /* eslint-disable-next-line react-hooks/exhaustive-deps */
    }, [tree]);

    return containerWidth ? (
        <Box width={`${containerWidth}px`} id={targetId} />
    ) : null;
};

export default ForceGraph;
