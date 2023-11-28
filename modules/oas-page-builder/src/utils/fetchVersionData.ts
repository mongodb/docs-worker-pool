import fetch from 'node-fetch';

export const fetchVersionData = async (gitHash: string, serverURL: string) => {
  const versionUrl = `${serverURL}${gitHash}-api-versions.json`;
  const res = await fetch(versionUrl);
  const { versions } = await res.json();
  return versions;
};
