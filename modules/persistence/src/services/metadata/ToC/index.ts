import { SharedMetadata, AssociatedProduct, ReposBranchesDocument } from '../associated_products';
import { convertSlugToUrl } from './utils/convertSlugToUrl';

export interface ToC {
  title: string;
  slug?: string;
  url?: string;
  children: ToC[];
  options?: {
    [key: string]: any;
  };
  [key: string]: any;
}

type project = string;
type branchName = string;
type branch = {
  [key: branchName]: {
    original: ToC;
    urlified: ToC;
  };
};

export interface ToCInsertions {
  [key: project]: branch;
}

export interface TocOrderInsertions {
  [key: string]: {
    [key: string]: any[];
  };
}

const isInsertionCandidateNode = (node: ToC, associated_products: AssociatedProduct[] = []): boolean => {
  const nodeInProducts = node.options?.project && associated_products.find((p) => p.name === node.options?.project);
  const nodeHasNoChildren = !node.children || node.children.length === 0;
  return !!(nodeHasNoChildren && nodeInProducts);
};

const mergeNode = (node: ToC, tocs: ToCInsertions) => {
  // Options might be undefined, so safely cast to {} if nullish
  node.options = node.options ?? {};

  const project = tocs[node?.options?.project];
  const branches = Object.keys(project);
  node.options.versions = branches;
  node.children = branches.map((branch) => {
    const child = project[branch];
    const options = {
      ...child.options,
      version: branch,
    };
    child.options = options;
    return child;
  });
  return node;
};

const mergeTocTreeOrder = (metadata: SharedMetadata, node, insertions: TocOrderInsertions) => {
  const insertion = insertions[metadata.project]?.[metadata.branch] || [];
  const index = metadata.toctreeOrder.indexOf(node.options?.project);
  return metadata.toctreeOrder.splice(index, 0, ...insertion);
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
  while (queue?.length) {
    let next = queue.shift();
    // TODO: We can exit early here once we've found all the nodes. We should add some break logic.
    if (next && isInsertionCandidateNode(next, associated_products)) {
      next = mergeNode(next, tocInsertions);
      metadata.toctreeorder = mergeTocTreeOrder(metadata, next, tocOrderInsertions);
    } else if (next?.children) {
      queue = [...queue, ...next.children];
    }
  }
  return metadata;
};

// Create a deep copy of a ToC, converting all slugs present to absolute urls.
export const urlifyToCTreeCopy = (toBeCopied: ToC, project, prefix, url): ToC => {
  const toctree = JSON.parse(JSON.stringify(toBeCopied));
  let queue = [toctree];
  while (queue?.length) {
    const next = queue.shift();
    if (next && next.slug) {
      next.url = convertSlugToUrl(next.slug, project, prefix, url);
      delete next.slug;
    }
    if (next?.children) queue = [...queue, ...next.children];
  }
  return toctree;
};

export const _isInsertionCandidateNode = isInsertionCandidateNode;
export const _mergeNode = mergeNode;
export const _mergeTocTreeOrder = mergeTocTreeOrder;
