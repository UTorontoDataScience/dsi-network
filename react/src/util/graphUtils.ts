import { stratify } from 'd3-hierarchy';
import { ModelEntity } from '../data/model';
import { DSINode } from '../types';

/* simple node for filtering  */
interface NNode {
    id: string;
    children: NNode[];
}

export const getEntityId = (entity: ModelEntity) =>
    `${entity.type}-${entity.id}`;

const makeTree = (entities: ModelEntity[], root: NNode) => {
    root.children = entities
        .filter(e => `${e.parentType}-${e.parentId}` === root.id)
        .map(e => makeTree(entities, { id: getEntityId(e), children: [] }));
    return root;
};

const getAllChildrenIds = (tree: NNode): string[] =>
    tree.children
        .map(e => e.id)
        .concat(tree.children.flatMap(t => getAllChildrenIds(t)));

/* building tree to filter is redundant -- if we keep this approach, streamline by adding filter method to d3's Node */
const filterEntities = (entities: ModelEntity[], root: ModelEntity) => {
    const tree = makeTree(entities, {
        id: `${root.type}-${root.id}`,
        children: [],
    });

    const childIds = getAllChildrenIds(tree);

    return entities.filter(
        f => f.name === root.name || childIds.includes(getEntityId(f))
    );
};

export const makeTreeStratify = (
    entities: ModelEntity[],
    root: ModelEntity
) => {
    const stratifyFn = stratify<ModelEntity>()
        .id(v => `${v.id}-${v.type}`)
        .parentId(p =>
            p.parentId && p.parentType ? `${p.parentId}-${p.parentType}` : null
        );

    const filtered = filterEntities(entities, root); /* .map(e => getId(e)) */

    return stratifyFn(filtered);
};

/* returns a new tree -- if mutation is ok, then use d3-hierarchy.node.eachBefore  */
export const mapTree = (
    node: DSINode,
    fn: (node: DSINode) => DSINode
): DSINode => {
    /* d3 doesn't export node constructor so we have to clone */
    let mappedNode = fn(node);
    const clone = Object.create(node);
    mappedNode = Object.assign(clone, mappedNode);
    if (node.children) {
        mappedNode.children = node.children.map(n => mapTree(n, fn));
    }
    return mappedNode;
};
