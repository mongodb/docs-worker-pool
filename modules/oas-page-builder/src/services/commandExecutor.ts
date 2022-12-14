import { exec } from 'child_process';
import { promisify } from 'util';

const execute = promisify(exec);

export const execRedoc = async (spec: string, outputPath: string, redocPath: string) => {
  const command = `node ${redocPath} build ${spec} --output ${outputPath}`;
  console.log(command);
  const { stdout, stderr } = await execute(command);
  if (stderr) {
    console.error(`Error trying to build page ${outputPath} with Redoc.`);
    throw stderr;
  }
  console.log(stdout);
};
