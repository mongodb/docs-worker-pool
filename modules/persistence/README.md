# Snooty Transport Module

As part of integrating Snooty Parser with the unified Snooty toolchain, this module holds exclusive responsibility over transporting and persisting AST and metadata output artifacts from the parser into datastores.

Currently, this module supports persistence to Mongodb Atlas instances, and is also responsible for mutation of entires at persist time.

## Installation

By default, this module requires Node v14.17.6 and uses a `.nvmrc` file if using nvm.
All that's required for use is running `npm ci`.

## Building and Running

### `npm run build`

Compiles the module using `tsc`. By default, compiles to the `./dist` directory.

### `npm run start`

Runs the contents of the `./dist` directory.
Requires usage of `-- -path` argument.
Recommended command for running in higher than local environments.

### `npm run dev`

Cleans dist, compiles, and runs with arguments `-- -path ./build`.

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
