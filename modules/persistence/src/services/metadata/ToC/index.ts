const isInsertionCandidateNode = (node, associated_products) => {
  const nodeInProducts = node.options?.version && associated_products.includes(node.options.version);
  const nodeHasNoChildren = node && (!node.children || node.children.length === 0);
  return nodeHasNoChildren && nodeInProducts;
};

const mergeNode = (node, tocs) => {
  node = tocs[node.property];
};

const mergeTocTreeOrder = (metadata, insertion) => {
  const index = metadata.toctreeorder.find(insertion);
  return metadata.toctreeorder.splice(index, 0, ...insertion);
};

export const traverseAndMerge = (metadata, tocInsertions, tocOrderInsertions) => {
  const { toctree, associated_products } = metadata;
  let queue = [toctree];
  while (queue) {
    const next = queue.pop();
    if (isInsertionCandidateNode(next, associated_products)) {
      mergeNode(next, tocInsertions);
      mergeTocTreeOrder(metadata, tocOrderInsertions);
    }
    if (next.children) queue = [...queue, ...next.children];
  }
  return metadata;
};
