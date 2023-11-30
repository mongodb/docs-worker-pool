export function getArgs() {
  const helpIdx = process.argv.findIndex((str) => str === '--help' || str === '-h');

  if (helpIdx !== -1) {
    console.log('TODO: Fill this out');

    process.exit(0);
  }
  const repoOwnerIdx = process.argv.findIndex((str) => str === '--repo-owner' || str === '-o');
  const repoNameIdx = process.argv.findIndex((str) => str === '--repo-name' || str === '-n');

  // optional
  const branchNameIdx = process.argv.findIndex((str) => str === '--branch-name' || str === '-b');

  if (repoOwnerIdx === -1)
    throw new Error(
      'Please provide a repo owner. The flag to provide this is --repo-owner, or you can use -o as well.'
    );

  if (repoNameIdx === -1)
    throw new Error('Please provide a repo name. The flag to provide this is --repo-name, or you can use -n as well.');

  if (repoOwnerIdx + 1 === process.argv.length) throw new Error('Please provide a value for the repo owner flag');
  if (process.argv[repoOwnerIdx + 1].startsWith('-'))
    throw new Error(`Please provide a valid repo owner value. Value provided: ${process.argv[repoOwnerIdx + 1]}`);

  if (repoNameIdx + 1 === process.argv.length) throw new Error('Please provide a value for the repo name flag');
  if (process.argv[repoNameIdx + 1].startsWith('-'))
    throw new Error(`Please provide a valid repo name value. Value provided: ${process.argv[repoNameIdx + 1]}`);

  if (branchNameIdx + 1 === process.argv.length) throw new Error('Please provide a value for the branch name flag');
  if (process.argv[branchNameIdx + 1].startsWith('-'))
    throw new Error(`Please provide a valid branch name value. Value provided: ${process.argv[branchNameIdx + 1]}`);

  const repoOwner = process.argv[repoOwnerIdx + 1];
  const repoName = process.argv[repoNameIdx + 1];
  const branchName = branchNameIdx !== -1 ? process.argv[branchNameIdx + 1] : 'master';

  return {
    repoOwner,
    repoName,
    branchName,
  };
}
