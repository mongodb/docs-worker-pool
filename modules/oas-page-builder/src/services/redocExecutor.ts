import { exec } from 'child_process';
import { promisify } from 'util';
import { RedocBuildOptions } from './types';
import { writeFileSync } from 'fs';

const execCommand = promisify(exec);

export class RedocExecutor {
  redocPath: string;
  // Options to be passed to Redoc build command
  private options: Record<string, any>;

  constructor(redocPath: string, siteUrl: string, siteTitle: string) {
    this.redocPath = redocPath;

    // Custom options DOP defines in the Redoc fork
    this.options = {
      backNavigationPath: siteUrl,
      siteTitle,
    };
  }

  // Calls Redoc CLI to build spec at given output path
  async execute(specSource: string, outputPath: string, buildOptions: RedocBuildOptions) {
    this.createOptionsFile(buildOptions);

    const outputArg = `--output ${outputPath}`;
    const optionsArg = `--options options.json`;
    const command = `node ${this.redocPath} build ${specSource} ${outputArg} ${optionsArg}`;

    const { stdout, stderr } = await execCommand(command);
    console.log(stdout);

    if (stderr) {
      console.error(`Error trying to build page ${outputPath} with Redoc.`);
      throw stderr;
    }
  }

  private createOptionsFile(buildOptions: RedocBuildOptions): void {
    const options = {
      ...this.options,
      ...buildOptions,
    };

    writeFileSync('options.json', JSON.stringify(options));
  }
}
