import { SharedMetadata, AssociatedProduct } from '../associations';

export interface ToC {
  title: string;
  slug: string;
  children: ToC[];
  options?: {
    [key: string]: any;
  };
  [key: string]: any;
}

export interface ToCInsertions {
  [key: string]: {
    // project : branch key value pair
    [key: string]: ToC; // branch : ToC key value pair
  };
}

export interface TocOrderInsertions {
  [key: string]: {
    [key: string]: any[];
  };
}

const isInsertionCandidateNode = (node: ToC, associated_products: AssociatedProduct[] = []) => {
  const nodeInProducts = node.options?.name && associated_products.find((p) => p.name === node.options?.name);
  const nodeHasNoChildren = !node.children || node.children.length === 0;
  return nodeHasNoChildren && nodeInProducts;
};

const mergeNode = (node: ToC, tocs: ToCInsertions) => {
  // Options might be undefined, so safely cast to {} if nullish
  node.options = node.options ?? {};

  const project = tocs[node?.options?.name];
  const branches = Object.keys(project);
  node.options.versions = branches;
  node.children = branches.map((branch) => {
    const child = project[branch];
    const options = {
      ...child[0].options,
      version: branch,
    };
    child[0].options = options;
    return child;
  });
  return node;
};

const mergeTocTreeOrder = (metadata: SharedMetadata, node, insertions: TocOrderInsertions) => {
  const insertion = insertions[metadata.project]?.[metadata.branch];
  const index = metadata.toctreeOrder.indexOf(node.options?.name);
  return metadata.toctreeorder.splice(index, 0, ...insertion);
};

// BFS through the toctree from the metadata entry provided as an arg
// and insert matching tocInsertion entries + tocOrders
export const traverseAndMerge = (
  metadata: SharedMetadata,
  tocInsertions: ToCInsertions,
  tocOrderInsertions: TocOrderInsertions
) => {
  const { toctree, associated_products } = metadata;

  let queue = [toctree];
  while (queue) {
    let next = queue.pop();
    if (next && isInsertionCandidateNode(next, associated_products)) {
      next = mergeNode(next, tocInsertions);
      metadata.toctreeorder = mergeTocTreeOrder(metadata, next, tocOrderInsertions);
    }
    if (next?.children) queue = [...queue, ...next.children];
  }
  return metadata;
};
