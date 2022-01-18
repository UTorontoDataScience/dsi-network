import { HierarchyNode, stratify } from 'd3-hierarchy';
import { ModelEntity } from '../data/model';

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

    /* we're going to break the references on each rebuild before setting parent to null (for now) */
    return entities
        .filter(f => f.name === root.name || childIds.includes(getEntityId(f)))
        .map(e => JSON.parse(JSON.stringify(e)));
};

export const makeTreeStratify = (
    entities: ModelEntity[],
    root: ModelEntity
) => {
    const stratifyFn = stratify<ModelEntity>()
        .id(getEntityId)
        .parentId(p =>
            p.parentId && p.parentType ? `${p.parentType}-${p.parentId}` : null
        );

    const filtered = filterEntities(entities, root);

    const newRoot = filtered.find(m => getEntityId(m) === getEntityId(root))!;

    newRoot.parentId = null;
    newRoot.parentType = null;

    return stratifyFn(filtered);
};

/* 
    returns a new tree -- if mutation is ok, then use d3-hierarchy.node.each*  
*/
export const mapTree = <T extends object, R extends HierarchyNode<T>>(
    node: HierarchyNode<T>,
    fn: (node: HierarchyNode<T>) => R
): R => {
    /* d3 doesn't export node constructor so we have to clone */
    let mappedNode = fn(node);
    const clone = Object.create(Object.getPrototypeOf(node));
    mappedNode = Object.assign(clone, mappedNode);
    if (node.children) {
        mappedNode.children = node.children.map(n => {
            n.parent = mappedNode;
            return mapTree(n, fn);
        });
    }
    return mappedNode;
};
