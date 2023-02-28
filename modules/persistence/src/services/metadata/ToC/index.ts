import { AssociatedProduct, hasAssociations } from '../associated_products';
import { Metadata } from '..';
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

const isInsertionCandidateNode = (node: ToC, toBeInserted: Set<string> = new Set([])): boolean => {
  // TODO: STRONGLY RECONSIDER POST LAUNCH, SHOULD PREFER 'ATLAS CLI <|atlas-cli|>' and only node.options?.project
  const projectName = node.options?.project || node.slug;
  const nodeInProducts = node.options?.project && toBeInserted.has(projectName);
  const nodeHasNoChildren = !node.children || node.children.length === 0;
  return !!((nodeHasNoChildren && nodeInProducts) || (!node.options?.project && nodeInProducts));
};

const mergeNode = (node: ToC, tocs: ToCInsertions, currentProject) => {
  // Options might be undefined, so safely cast to {} if nullish
  node.options = node.options ?? {};
  const needsUrlifiedToC = currentProject !== node?.options?.project;

  const associatedProject = tocs[node?.options?.project];
  if (!associatedProject) return node;
  const branches = Object.keys(associatedProject);
  node.options.versions = branches;
  node.options.urls = node.options.urls || {};
  for (const branch of branches) {
    node.options.urls[branch] = associatedProject[branch]['urlified']?.url;
  }

  if (node.options?.project === currentProject) {
    // this node is targeted to be this same project.
    // update the slug to be the root slug.
    node.slug = '/';
    delete node.url;
  } else {
    // umbrella project targeting associated ToC node
    // handle slugs with node.options.urls instead
    delete node.slug;
  }

  node.children = branches.reduce((children: ToC[], branch) => {
    // when merging ToC nodes, copy the nested children within the root node of associated product.
    // we are skipping the root node that leads to '/' path within the project itself
    const rootChild = needsUrlifiedToC ? associatedProject[branch].urlified : associatedProject[branch].original;
    const copiedChildren = rootChild.children.map((originalNode: ToC) => {
      originalNode.options = {
        ...originalNode.options,
        version: branch,
      };
      return originalNode;
    });
    return children.concat(copiedChildren);
  }, []);
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
  const toBeInserted = new Set(associated_products.map((p) => p.name));
  let queue = [toctree];
  while (queue?.length && toBeInserted.size) {
    let next = queue.shift();
    // TODO: We can exit early here once we've found all the nodes.
    // We should track remaining insertions in a set and add some break logic.
    if (next && isInsertionCandidateNode(next, toBeInserted)) {
      next = mergeNode(next, tocInsertions, project);
      metadata.toctreeorder = mergeTocTreeOrder(metadata, next, tocOrderInsertions);
      toBeInserted.delete(next.options?.project);
    } else if (next?.children) {
      queue = [...queue, ...next.children];
    }
  }
  metadata.toctree = toctree;
  return metadata;
};

// Create a deep copy of a ToC, converting all slugs present to absolute urls if project, prefix and url is provided.
// Copy logic should be tightly coupled to the urlification logic here - we DON'T want to mutate the base ToC objects.
export const copyToCTree = (toBeCopied: ToC, prefix?: string, url?: string, alias?: string): ToC => {
  const toctree = JSON.parse(JSON.stringify(toBeCopied));
  if (!prefix || !url) return toctree;
  let queue = [toctree];
  while (queue?.length) {
    const next = queue.shift();
    if (next && next.slug) {
      next.url = convertSlugToUrl(next.slug, prefix, url, alias);
      delete next.slug;
    }
    if (next?.children) queue = [...queue, ...next.children];
  }
  return toctree;
};

export const _isInsertionCandidateNode = isInsertionCandidateNode;
export const _mergeNode = mergeNode;
export const _mergeTocTreeOrder = mergeTocTreeOrder;
