export const fetchVersionData = async (gitHash: string) => {
  const versionUrl = `https://mongodb-mms-prod-build-server.s3.amazonaws.com/openapi/${gitHash}-api-versions.json`;
  const res = await fetch(versionUrl);
  const { versions } = await res.json();
  return versions;
};
