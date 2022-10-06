# Snooty Transport Module

As part of integrating Snooty Parser with the unified Snooty toolchain, this module holds exclusive responsibility over transporting and persisting AST and metadata output artifacts from the parser into datastores.

Currently, this module supports persistence to Mongodb Atlas instances, and is also responsible for mutation of entries at persist time.

## Installation

By default, this module requires Node v14.17.6 and uses a `.nvmrc` file if using nvm.
Running `npm ci` to install all dependencies is required for usage.

An example environment file is available at `sample.env`.
Copy this file to `.env` in order to use a local environment file.

## Building and Running

### `npm run build`

Compiles the module using `tsc`. By default, compiles to the `./dist` directory.

### `npm run start`

Runs the contents of the `./dist` directory.
Requires usage of `-- -path` argument, eg `npm run start -- --path ./build/artifacts.zip`.
Recommended command for running this module in higher than local environments.
Requires parser output artifacts to be present in specified directory and zip file at `--path` value specified.

### `npm run dev`

Cleans dist, compiles, and runs with arguments `-path ./build/artifacts.zip`.
Requires parser output artifacts to be present in specified directory and zip file at `./build/artifacts.zip`.

## Available Arguments

This module utilizes [minimist](https://www.npmjs.com/package/minimist) for argument parsing.
For more information on accepted argument formats, please consult [its documentation](https://www.npmjs.com/package/minimist).

### `-path`

| values | any string |
| ------ | ---------- |

Required string formatted filepath where build artifacts are housed.

### `-strict`

| values | 'y', 'yes', 'true' |
| ------ | ------------------ |

Optional string formatted argument for whether module should exit with non-zero status on failure.
Highly recommended for use in production environments.

## Using/Developing This Module

Usage and development of this module requires specifying the following environment variables. Use of a `.env` file is supported, but only recommended for local development.

If adding a new environment variable, please update the `sample.env`. The `sample.env` should be considered the primary documentation for supported environment variables within this module.
