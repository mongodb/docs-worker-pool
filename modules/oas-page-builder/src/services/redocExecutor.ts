import { exec } from 'child_process';
import { promisify } from 'util';
import { RedocBuildOptions, RedocVersionOptions } from './types';
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
  async execute(
    specSource: string,
    outputPath: string,
    buildOptions: RedocBuildOptions,
    versionOptions?: RedocVersionOptions
  ) {
    const outputArg = `--output ${outputPath}`;
    const optionsArg = `--options '${this.finalizeOptions(buildOptions)}'`;

    let versionDataOptionsArgs = '';

    if (versionOptions) {
      this.createVersionDataFile(versionOptions);
      versionDataOptionsArgs = '--options.versionData=version-data.json';
    }

    const command = `node ${this.redocPath} build ${specSource} ${outputArg} ${optionsArg} ${versionDataOptionsArgs}`;

    const { stdout, stderr } = await execCommand(command);
    console.log(stdout);

    if (stderr) {
      console.error(`Error trying to build page ${outputPath} with Redoc.`);
      throw stderr;
    }
  }

  private createVersionDataFile(versionOptions: RedocVersionOptions): void {
    writeFileSync('version-data.json', JSON.stringify(versionOptions));
  }

  // Adds any additional options required for current page
  private finalizeOptions(buildOptions: RedocBuildOptions): string {
    const options = {
      ...this.options,
      ...buildOptions,
    };
    // Stringify JSON object to avoid syntax error when passing object
    return JSON.stringify(options);
  }
}
