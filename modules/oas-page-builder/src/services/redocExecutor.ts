import { exec } from 'child_process';
import { promisify } from 'util';
import { RedocBuildOptions } from './types';

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
  async execute(specSource: string, outputPath: string, buildOptions: RedocBuildOptions = {}) {
    const outputArg = `--output ${outputPath}`;
    const optionsArg = `--options '${this.finalizeOptions(buildOptions)}'`;
    const command = `node ${this.redocPath} build ${specSource} ${outputArg} ${optionsArg}`;

    const { stdout, stderr } = await execCommand(command);
    console.log(stdout);

    if (stderr) {
      console.error(`Error trying to build page ${outputPath} with Redoc.`);
      throw stderr;
    }
  }

  // Adds any additional options required for current page
  private finalizeOptions(buildOptions: RedocBuildOptions = {}): string {
    const options = this.options;
    for (const [option, val] of Object.entries(buildOptions)) {
      options[option] = val;
    }
    return JSON.stringify(options);
  }
}
