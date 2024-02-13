import axios from 'axios';
import fs from 'fs';
import { executeCliCommand, getCommitBranch, getCommitHash, getPatchId, getRepoDir } from '.';
import { finished } from 'stream';
import { open } from 'fs';

export async function testAxios(repoName: string, directory?: string) {
  const repoDir = getRepoDir(repoName, directory);
  const buildPath = `${repoDir}/source/driver-examples/maya.go`;
  const url = 'https://raw.githubusercontent.com/mongodb/mongo-go-driver/master/internal/docexamples/examples.go';
  try {
    const res = await axios.get(url, { timeout: 10000, responseType: 'stream' });
    console.log('MAYA RES');
    console.log(res);
    console.log('maya buildPath', buildPath);
    const write = fs.createWriteStream(buildPath);
    res.data.pipe(write);
    await finished(write, async (err) => {
      if (err) {
        console.error('MAYA Stream failed.', err);
      } else {
        console.log('MAYA Stream is done reading.');
        await executeCliCommand({ command: 'cat', args: [`${buildPath}`] });
      }
    });
    // await executeCliCommand({ command: 'cat', args: [`${buildPath}`] });
    await executeCliCommand({ command: 'ls', args: ['-al', `${repoDir}/source/driver-examples`] });
    return `Downloading ${url} into ${buildPath}`;
  } catch (error) {
    return `ERROR! Could not download ${url} into ${buildPath}. ${error}`;
  }
}
