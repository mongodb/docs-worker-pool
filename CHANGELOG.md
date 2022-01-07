# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.4.5] - 2020-08-13

### changed

- remove build call (`make next-gen-html`) from S3Publish.js and remove next-gen-publish and next-gen-html-publish targets from all makefiles (DOP-1238)
- next-gen-deploy is always passed the path prefix from the command line

### added

- server writes env.production file for all jobs, but only constructs PATH_PREFIX for production deploy and stagel commit jobs (DOP-1238, DOP-1253)

## [v0.4.4] - 2020-08-13

### changed

- ubuntu upgraded to 20.04

## [v0.4.3] - 2020-06-23

### added

- regression test framework (DOP-570)

### Fixed

- Fastly purge fixes to slack output (DOP-966)

## [v0.4.2] - 2020-06-01

### added

- commitless/pushless staging now uses patch_id in url to prevent build collision (DOP-1089)

### Fixed

- Fastly purge cache functionality (DOP-857)

- Parser failures now propagate to build status (DOP-64)

## [v0.4.1] - 2020-04-29

### added

- added Fastly purge cache functionality (DOP-857)

- update Dockerfiles to only download production modules (DOP-999)

## [v0.4.0] - 2020-04-16

### added

- update autobuilder to work with new published_branches location (DOP-967)

- update autobuilder dockerfiles to use lexigraphic ordering for pulling releases (DOP-943)

## [v0.3.1] - 2020-01-31

### added

- production deploy functionality in autobuilder (DOCSPLAT-299)

- cmdline interface for non-git builds (DOCSPLAT-522)

## [v0.2.1] - 2020-01-31

### Fixed

- change addJobToQueue function to accommodate multiple builds of the same status (DOCSP-8567)

- one job per repo-branch-commit should be in-queue or in-progress (DOCSP-8451)

### added

- use commit hash for builds (DOCSP-8566)

- run commit based builds (DOCSP-8278)

- validation of user permissions to publish (DOCSP-7930)

## [v0.2.0] - 2020-01-24

### Fixed

- ecosystem makefile wasn't pulling examples for staging builds (DOCSP-8472)

### changed

- refactored Dochub application (DOCSP-8126)

- builds are now based on commits (DOCSP-8278)

- builds are now bound and consolidated with parser and front-end (DOCSP-8124)

### added

- add job to handle production deployment (DOCSP-7000)

- slack deploy

- validation of user permissions to publish (DOCSP-7930)

## [v0.1.0] - 2020-01-12

### added

- Health monitoring for docs-worker-pool jobs and processes (DOCSP-7823, DOCSP-7729

- Integration with Dochub Database (DOCSP-7636)

- Fastly integration (DOCSP-8279)

### changed

- Refactor in preparation for productin deploy jobs (DOCSP-7001)

## [v0.0.9] - 2019-11-13

### Added

- Support for next-gen builds (DOCSP-6545)

- Integrate snooty parser with autobuilder (DOCSP-6658)

- Support for baas-docs slack output (DOCSP-6399)

- Support for key generation for machine-created builds (DOCSP-7344)

- Support for discovering world and repo build repositories (DOCSP-7002)

- Support for entitlements check for doc user publish (DOCSP-7003)

### Changed

- Refactored build pipeline to accommodate common build path for deploy and stage (DOCSP-7001)

### Fixed

- Support for baas-docs slack output (DOCSP-6399)

- Fixed timeout behavior to prevent outages (DOCSP-7729)

## [v0.0.9] - 2019-11-13

### Added

- Support for next-gen builds (DOCSP-6545)

- Integrate snooty parser with autobuilder (DOCSP-6658)

- Support for baas-docs slack output (DOCSP-6399)

- Support for key generation for machine-created builds (DOCSP-7344)

- Support for discovering world and repo build repositories (DOCSP-7002)

- Support for entitlements check for doc user publish (DOCSP-7003)

### Changed

- Refactored build pipeline to accommodate common build path for deploy and stage (DOCSP-7001)

### Fixed

- Support for baas-docs slack output (DOCSP-6399)

- Fixed timeout behavior to prevent outages (DOCSP-7729)
