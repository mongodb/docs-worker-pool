import { normalizePath } from './normalizePath';

// Normalizes the pathname of a URL by removing repeated forward slashes
export const normalizeUrl = (url: string) => {
  const urlObject = new URL(url);
  urlObject.pathname = normalizePath(urlObject.pathname);
  return urlObject.href;
};
