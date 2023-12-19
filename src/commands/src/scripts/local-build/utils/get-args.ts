export function getArgs() {
  const helpIdx = process.argv.findIndex((str) => str === '--help' || str === '-h');

  if (helpIdx !== -1) {
    console.log(`
      This command builds and runs the Autobuilder for local debugging.

      Flags:
      --repo-owner,  -o  (required)       The owner of the repo. Typically this is 'mongodb' or '10gen'. This should be your username for a fork.
      --repo-name,   -n  (required)       The name of the repo e.g. docs-java or cloud-docs.
      --directory,   -d  (optional)       The project directory path for a monorepo project.
      --branch-name, -d  (optional)       The branch name we want to parse. If not provided, the value 'master' is used by default.
    `);

    process.exit(0);
  }
  const repoOwnerIdx = process.argv.findIndex((str) => str === '--repo-owner' || str === '-o');
  const repoNameIdx = process.argv.findIndex((str) => str === '--repo-name' || str === '-n');

  // optional args
  const directoryIdx = process.argv.findIndex((str) => str === '--directory' || str === '-d');
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

  if (directoryIdx + 1 === process.argv.length)
    throw new Error('Please provide a value for the monorepo directory flag');
  if (process.argv[directoryIdx + 1].startsWith('-'))
    throw new Error(
      `Please provide a valid monorepo directory value. Value provided: ${process.argv[directoryIdx + 1]}`
    );

  if (branchNameIdx + 1 === process.argv.length) throw new Error('Please provide a value for the branch name flag');
  if (process.argv[branchNameIdx + 1].startsWith('-'))
    throw new Error(`Please provide a valid branch name value. Value provided: ${process.argv[branchNameIdx + 1]}`);

  const repoOwner = process.argv[repoOwnerIdx + 1];
  const repoName = process.argv[repoNameIdx + 1];
  const directory = directoryIdx !== -1 ? process.argv[directoryIdx + 1] : undefined;
  const branchName = branchNameIdx !== -1 ? process.argv[branchNameIdx + 1] : 'master';

  return {
    repoOwner,
    repoName,
    directory,
    branchName,
  };
}
