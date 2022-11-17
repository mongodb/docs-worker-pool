# OpenAPI Content Page Builder

The OpenAPI Content Page Builder is a module dedicated to building OpenAPI content
pages on the MongoDB Documentation site out of OpenAPI spec (OAS) files.

This module is intended to be called after the Snooty [parser](https://github.com/mongodb/snooty-parser) and [frontend](https://github.com/mongodb/snooty) have completed their
tasks, but before [mut](https://github.com/mongodb/mut) uploads files to S3.

## Installation

If using `nvm`, run `nvm use` to ensure you're using the intended version
of Node found in `.nvmrc`.

To install dependencies, run:

```
npm ci
```

Ensure that the proper environment variables are set up locally. `sample.env`
contains environment variables that can be copied to a local `.env` file.

### Building

The module is compiled by `tsc` to `./dist/index.js`. Run the following to build:

```
npm run build
```

If developing locally, build in between runs to ensure the compiled JS file contains
the latest changes.

### Running

Make sure the module has been built/compiled with an existing `./dist/index.js` file.
Run the following to run the module:

```
npm run start -- --bundle <path> --output <path> --redoc <path> --repo <path>
```

All of the options above are required for the module to run properly. Run
`npm run start -- --help` for more information or see [(Required) Options](#required-options).

**Example**

The following example shows what the command would be like if ran through the
autobuilder. If running locally, update the paths according to your local setup.

```
npm run start -- --bundle /home/docsworker-xlarge/repos/cloud-docs/bundle.zip --output /home/docsworker-xlarge/repos/cloud-docs/public/ --redoc /home/docsworker-xlarge/redoc/cli/index.js --repo /home/docsworker-xlarge/repos/cloud-docs/
```

### (Required) Options

| Option | Description                                                                                                                                                                            |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bundle | Path to the parsed bundle zip file. This should be the output of the parser and will be used to obtain build metadata about OpenAPI content pages.                                     |
| output | Path to the directory that the OpenAPI content pages should be built to. Typically, this would be the same output `public/` directory of a Snooty frontend build.                      |
| redoc  | Path to the local installation of Redoc CLI to use. This should point to the team's [fork of Redoc](https://github.com/mongodb-forks/redoc), with the target being a compiled JS file. |
| repo   | Path to the parsed docs repo's directory. This is to ensure that OpenAPI content pages using local OAS files can be properly sourced and passed down as an argument to Redoc CLI.      |
