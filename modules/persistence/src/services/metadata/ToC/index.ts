import { Metadata, AssociatedProduct, ReposBranchesDocument, hasAssociations } from '../associated_products';
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
  [key: branchName]: ToCCopies;
};
type ToCCopies = {
  original: ToC;
  urlified: ToC;
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

const mergeNode = (node: ToC, tocs: ToCInsertions, currentProject) => {
  // Options might be undefined, so safely cast to {} if nullish
  node.options = node.options ?? {};
  const needsUrlifiedToC = currentProject !== node?.options?.project;

  const associatedProject = tocs[node?.options?.project];
  if (!associatedProject) return node;
  const branches = Object.keys(associatedProject);
  node.options.versions = branches;
  node.children = branches.map((branch) => {
    const child = needsUrlifiedToC ? associatedProject[branch].urlified : associatedProject[branch].original;
    const options = {
      ...child.options,
      version: branch,
    };
    child.options = options;
    return child;
  });
  return node;
};

const mergeTocTreeOrder = (metadata: Metadata, node, insertions: TocOrderInsertions) => {
  const insertion = insertions[metadata.project]?.[metadata.branch] || [];
  const index = metadata.toctreeOrder.indexOf(node.options?.project);
  return metadata.toctreeOrder.splice(index, 0, ...insertion);
};

// BFS through the toctree from the metadata entry provided as an arg
// and insert matching tocInsertion entries + tocOrders
// determines base vs. urlified umbrellaToC by whether or not the metadata provided
// contains an associated_products entry
export const traverseAndMerge = (
  metadata: Metadata,
  associated_products: AssociatedProduct[],
  umbrellaToCs: ToCCopies,
  tocInsertions: ToCInsertions,
  tocOrderInsertions: TocOrderInsertions
) => {
  const { project } = metadata;

  const toctree = hasAssociations(metadata) ? umbrellaToCs.original : umbrellaToCs.urlified;

  let queue = [toctree];
  while (queue?.length) {
    let next = queue.shift();
    // TODO: We can exit early here once we've found all the nodes.
    // We should track remaining insertions in a set and add some break logic.
    if (next && isInsertionCandidateNode(next, associated_products)) {
      next = mergeNode(next, tocInsertions, project);
      metadata.toctreeorder = mergeTocTreeOrder(metadata, next, tocOrderInsertions);
    } else if (next?.children) {
      queue = [...queue, ...next.children];
    }
  }
  metadata.toctree = toctree;
  return metadata;
};

// Create a deep copy of a ToC, converting all slugs present to absolute urls if project, prefix and url is provided.
// Copy logic should be tightly coupled to the urlification logic here - we DON'T want to mutate the base ToC objects.
export const copyToCTree = (toBeCopied: ToC, project?: string, prefix?: string, url?: string): ToC => {
  const toctree = JSON.parse(JSON.stringify(toBeCopied));
  if (!prefix || !url || !project) return toctree;
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
