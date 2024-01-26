# Cache Update Worker

This directory contains the code for the cache update worker. The cache update worker rebuilds Snooty cache files and uploads them to the `snooty-parse-cache` S3 bucket whenever a cache invalidation event occurs.

A cache invalidation event occurs under two circumstances:

1. A doc site's `snooty.toml` file is changed; in this case, only the individual doc site's cache is rebuilt

2. An updated version of the Snooty Parser is used by the Autobuilder; all doc sites' Snooty caches will be rebuilt in this event

### Architecture

The cache update worker is an ephemeral ECS task that is spun up in response to a cache invalidation event. The doc sites that need to be rebuilt will be provided as an environment variable called `REPOS`. This is an array of objects that contain the `repoOwner` and `repoName` properties. The task is capable of processing multiple uploads concurrently. The code defined for it can be found in `src/cache-updater.ts`.

The infrastructure defined for the worker is defined [here](../../cdk-infra/lib/constructs/cache-updater/cache-updater-worker-construct.ts).

(TODO): Update README when [DOP-4171 is complete](https://jira.mongodb.org/browse/DOP-4171).

Diagram outlining the cache update process:

![Snooty Parse Cache Diagram](../../images/snooty-cache-updater.svg)
