export const convertSlugToUrl = (slug, projectSlug, prefix, url) => {
  return ensureTrailingSlash(url) + ensureTrailingSlash(prefix) + projectSlug + ensureLeadingSlash(slug);
};

const ensureTrailingSlash = (subpath: string) => {
  return subpath.endsWith('/') ? subpath : `${subpath}/`;
};

const ensureLeadingSlash = (subpath: string) => {
  return subpath.startsWith('/') ? subpath : `/${subpath}`;
};
