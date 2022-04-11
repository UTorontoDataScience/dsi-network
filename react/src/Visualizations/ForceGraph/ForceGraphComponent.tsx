import React, { useEffect, useState } from 'react';
import { Box, useTheme } from '@mui/material';
import { HierarchyNode } from 'd3-hierarchy';
import { DSINode, EntityType, ModelEntity } from '../../types';
import { getEntityId } from '../../util';
import D3ForceGraph, { hideToolTip } from './ForceGraph';

export interface SelectedModel {
    id: number;
    type: EntityType;
}
interface ForceGraphProps {
    onBackgroundClick: () => void;
    onNodeClick: (node: DSINode) => void;
    tree: HierarchyNode<ModelEntity>;
    focusNode?: DSINode;
}

const ForceGraph: React.FC<ForceGraphProps> = ({
    onBackgroundClick,
    onNodeClick,
    tree,
    focusNode,
}) => {
    const [Graph, setGraph] = useState<D3ForceGraph>();

    const theme = useTheme();

    const targetId = 'target';

    /* initialize */
    useEffect(() => {
        if (tree && !Graph) {
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
    }, [Graph, onBackgroundClick, onNodeClick, tree, theme]);

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
        if (!Graph) {
            return;
        }
        if (focusNode) {
            const nid = getEntityId(focusNode.data);
            const positionedNode = Graph.simulation
                .nodes()
                .find(n => getEntityId(n.data) === nid);
            if (positionedNode) {
                hideToolTip(); // in case tooltip was 'forced' rather than triggered by hover
                Graph.zoomToNode(
                    positionedNode,
                    0,
                    Graph.forceToolTip.bind(
                        null,
                        getEntityId(positionedNode.data)
                    )
                );
            }
        } else {
            Graph.resetZoom();
        }
    }, [Graph, focusNode]);

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

    return <Box width="100%" id={targetId} />;
};

export default ForceGraph;
