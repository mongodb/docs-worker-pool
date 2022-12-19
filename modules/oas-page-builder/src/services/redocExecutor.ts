import { exec } from 'child_process';
import { promisify } from 'util';

const execCommand = promisify(exec);

export class RedocExecutor {
  redocPath: string;
  // Stringified options object for Redoc command. Redoc also accepts individual options or a JSON file
  private _optionsString: string;

  constructor(redocPath: string, siteUrl: string, siteTitle: string) {
    this.redocPath = redocPath;

    // Custom options DOP defines in the Redoc fork
    const customOptions = {
      backNavigationPath: siteUrl,
      siteTitle,
    };

    // May contain both native Redoc options and custom DOP options in the future
    this._optionsString = JSON.stringify({ customOptions });
  }

  // Calls Redoc CLI to build spec at given output path
  async execute(specSource: string, outputPath: string) {
    const outputArg = `--output ${outputPath}`;
    const optionsArg = `--options '${this._optionsString}'`;
    const command = `node ${this.redocPath} build ${specSource} ${outputArg} ${optionsArg}`;

    const { stdout, stderr } = await execCommand(command);
    console.log(stdout);

    if (stderr) {
      console.error(`Error trying to build page ${outputPath} with Redoc.`);
      throw stderr;
    }
  }
}
