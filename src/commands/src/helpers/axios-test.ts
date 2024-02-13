import axios from 'axios';
import fs from 'fs';
import { executeCliCommand, getCommitBranch, getCommitHash, getPatchId, getRepoDir } from '.';

export async function testAxios(repoName: string, directory?: string) {
  const repoDir = getRepoDir(repoName, directory);
  const buildPath = `${repoDir}/source/driver-examples/maya.go`;
  const url = 'https://raw.githubusercontent.com/mongodb/mongo-go-driver/master/internal/docexamples/examples.go';
  try {
    const res = await axios.get(url, { timeout: 10000, responseType: 'stream' });
    console.log('MAYA RES');
    console.log(res);
    console.log('maya buildPath', buildPath);
    await res.data.pipe(fs.createWriteStream(buildPath));
    console.log('PIPED? IDK');
    await executeCliCommand({ command: 'cat', args: [`${buildPath}`] });
    await executeCliCommand({ command: 'ls', args: ['-al', `${repoDir}/source/driver-examples`] });
    return `Downloading ${url} into ${buildPath}`;
  } catch (error) {
    return `ERROR! Could not download ${url} into ${buildPath}. ${error}`;
  }
}
