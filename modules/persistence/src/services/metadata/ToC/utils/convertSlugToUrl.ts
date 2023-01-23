export const convertSlugToUrl = (slug, prefix, url) => {
  return ensureTrailingSlash(url) + prefix + ensureLeadingSlash(slug);
};

const ensureTrailingSlash = (subpath: string) => {
  return subpath.endsWith('/') ? subpath : `${subpath}/`;
};

const ensureLeadingSlash = (subpath: string) => {
  return subpath.startsWith('/') ? subpath : `/${subpath}`;
};
