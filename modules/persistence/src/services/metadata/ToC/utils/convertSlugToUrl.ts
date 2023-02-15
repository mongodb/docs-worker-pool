export const convertSlugToUrl = (slug, prefix, url, alias) => {
  const leading = ensureTrailingSlash(url) + prefix;
  const trailing = alias ? ensureLeadingSlash(alias) + ensureLeadingSlash(slug) : ensureLeadingSlash(slug);
  return leading + trailing;
};

const ensureTrailingSlash = (subpath: string) => {
  return subpath.endsWith('/') ? subpath : `${subpath}/`;
};

const ensureLeadingSlash = (subpath: string) => {
  return subpath.startsWith('/') ? subpath : `/${subpath}`;
};
