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
    [key: string]: ToC;
  };
}

export interface TocOrderInsertions {
  [key: string]: {
    [key: string]: any[];
  };
}

const isInsertionCandidateNode = (node: ToC, associated_products: AssociatedProduct[] = []) => {
  const nodeInProducts = node.options?.version && associated_products.includes(node.options.version);
  const nodeHasNoChildren = node && (!node.children || node.children.length === 0);
  return nodeHasNoChildren && nodeInProducts;
};

const mergeNode = (node: ToC, tocs: ToCInsertions) => {
  return tocs[node?.options?.property]?.[node?.options?.branch] || node;
};

const mergeTocTreeOrder = (metadata: SharedMetadata, node, insertions: TocOrderInsertions) => {
  const insertion = insertions[metadata.project]?.[metadata.branch];
  const index = metadata.toctreeOrder.indexOf('stub');
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
