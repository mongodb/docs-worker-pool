export const convertSlugToUrl = (slug, prefix, url, alias) => {
  return ensureTrailingSlash(url) + prefix + ensureLeadingSlash(alias) + ensureLeadingSlash(slug);
};

const ensureTrailingSlash = (subpath: string) => {
  return subpath.endsWith('/') ? subpath : `${subpath}/`;
};

const ensureLeadingSlash = (subpath: string) => {
  return subpath.startsWith('/') ? subpath : `/${subpath}`;
};
