import type { Job } from '../../src/entities/job';
import { CommandExecutorResponse } from '../../src/services/commandExecutor';
import { getBuildJobDef } from '../data/jobDef';

export class TestDataProvider {
  static getJobPropertiesValidateTestCases(): Array<any> {
    return [].concat(
      TestDataProvider.getNullProperitesDataWithErrorForValidator(),
      TestDataProvider.getNonAsciiProperitesDataWithErrorForValidator(),
      TestDataProvider.getNonStandardProperitesDataWithErrorForValidator()
    );
  }
  static getJobPropertiesToValidate(): any {
    return [
      { prop: 'repoName', value: '', expectedError: 'Invalid Reponame' },
      { prop: 'branchName', value: '', expectedError: 'Invalid Branchname' },
      { prop: 'repoOwner', value: '', expectedError: 'Invalid RepoOwner' },
    ];
  }
  static getNullProperitesDataWithErrorForValidator() {
    const props = TestDataProvider.getJobPropertiesToValidate();
    props.forEach((element) => {
      element.value = null;
    });
    return props;
  }

  static getNonAsciiProperitesDataWithErrorForValidator() {
    const props = TestDataProvider.getJobPropertiesToValidate();
    props.forEach((element) => {
      element.value = '£asci§©©';
    });
    return props;
  }

  static getNonStandardProperitesDataWithErrorForValidator() {
    const props = TestDataProvider.getJobPropertiesToValidate();
    props.forEach((element) => {
      element.value = '()??*&^)(*d))';
    });
    return props;
  }

  static getPublishBranchesContent(job: Job): any {
    return {
      repoName: job.payload.repoName,
      branches: [
        {
          name: job.payload.branchName,
          publishOriginalBranchName: true,
          active: true,
          aliases: ['current'],
          gitBranchName: job.payload.branchName,
          urlSlug: 'current',
          versionSelectorLabel: 'latest stable',
          urlAliases: ['current'],
          isStableBranch: true,
        },
        {
          name: 'beta',
          publishOriginalBranchName: true,
          active: true,
          aliases: ['upcoming'],
          gitBranchName: 'beta',
          urlAliases: ['upcoming'],
          urlSlug: 'upcoming',
          versionSelectorLabel: 'beta',
          isStableBranch: false,
        },
        {
          name: 'DOP-1979',
          publishOriginalBranchName: true,
          active: true,
          aliases: null,
          gitBranchName: 'DOP-1979',
          urlAliases: null,
          urlSlug: null,
          versionSelectorLabel: 'DOP-1979',
          isStableBranch: false,
        },
      ],
      bucket: {
        regression: 'docs-mongodb-org-stg',
        dev: 'docs-mongodb-org-dev',
        stg: 'docs-mongodb-org-stg',
        prd: 'docs-mongodb-org-prd',
        dotcomstg: 'docs-mongodb-org-dotcomstg',
        dotcomprd: 'docs-mongodb-org-dotcomprd',
      },
      url: {
        regression: 'https://docs-mongodbcom-integration.corp.mongodb.com',
        dev: 'https://docs-mongodborg-staging.corp.mongodb.com',
        stg: 'https://docs-mongodborg-staging.corp.mongodb.com',
        prd: 'https://docs.mongodb.com',
        dotcomstg: 'https://mongodbcom-cdn.website.staging.corp.mongodb.com/',
        dotcomprd: 'http://mongodb.com/',
      },
      prefix: 'compass',
      project: 'compass',
    };
  }

  static configureRepoBranches(job: Job): Job {
    job.payload.repoBranches = TestDataProvider.getPublishBranchesContent(job);
    return job;
  }

  static configurePublishedBranchesWithPrimaryAlias(job: Job): Job {
    job.payload.primaryAlias = job.payload.branchName;
    return TestDataProvider.configureRepoBranches(job);
  }

  static configurePublishedBranchesWithOutPrimaryAliasAndAliasSet(job: Job): Job {
    job.payload.primaryAlias = null;
    job.payload.aliased = true;
    return TestDataProvider.configureRepoBranches(job);
  }

  static getCommitCheckValidResponse(job: Job): any {
    const resp = new CommandExecutorResponse();
    resp.output = `* ${job.payload.branchName}`;
    resp.error = null;
    resp.status = 'success';
    return resp;
  }

  static getCommitCheckInValidResponse(): any {
    const resp = new CommandExecutorResponse();
    resp.output = `* unknown values`;
    resp.error = null;
    resp.status = 'success';
    return resp;
  }

  static getAllCommitCheckCases(): Array<any> {
    return [null, {}, TestDataProvider.getCommitCheckInValidResponse(), 'THROW'];
  }

  static getCommonBuildCommands(job: Job): Array<string> {
    return [`. /venv/bin/activate`, `cd repos/${job.payload.repoName}`, `rm -f makefile`, `make html`];
  }

  static getExpectedProdBuildNextGenCommands(job: Job): Array<string> {
    const genericCommands = TestDataProvider.getCommonBuildCommands(job);
    return Array<string>().concat(genericCommands.slice(0, genericCommands.length - 1), [
      'make get-build-dependencies',
      'make next-gen-parse',
      `make persistence-module JOB_ID=${job._id}`,
      'make next-gen-html',
      `make oas-page-build MUT_PREFIX=${job.payload.mutPrefix}`,
    ]);
  }

  static getExpectedManifestBuildNextGenCommands(job: Job): Array<string> {
    const genericCommands = TestDataProvider.getCommonBuildCommands(job);
    return Array<string>().concat(genericCommands.slice(0, genericCommands.length - 1), [
      'make get-build-dependencies',
      'make next-gen-parse',
    ]);
  }

  static getExpectedStagingBuildNextGenCommands(job: Job): Array<string> {
    const genericCommands = TestDataProvider.getCommonBuildCommands(job);
    const commands = Array<string>().concat(genericCommands.slice(0, genericCommands.length - 1), [
      'make next-gen-parse',
      `make persistence-module GH_USER=${job.payload.repoOwner} JOB_ID=${job._id}`,
      `make next-gen-html`,
    ]);
    const project = job.payload.project === 'cloud-docs' ? job.payload.project : '';
    const branchName = /^[a-zA-Z0-9_\-\./]+$/.test(job.payload.branchName) ? job.payload.branchName : '';
    commands.push(
      `make oas-page-build MUT_PREFIX=${job.payload.mutPrefix} PROJECT=${project} BRANCH_NAME=${branchName}`
    );
    return commands;
  }

  static getEnvVarsWithPathPrefixWithFlags(job: Job): string {
    return `GATSBY_PARSER_USER=TestUser\nGATSBY_PARSER_BRANCH=${job.payload.branchName}\nPATH_PREFIX=${job.payload.pathPrefix}\nGATSBY_BASE_URL=test\nPREVIEW_BUILD_ENABLED=false\nGATSBY_TEST_SEARCH_UI=false\nGATSBY_SHOW_CHATBOT=false\nGATSBY_HIDE_UNIFIED_FOOTER_LOCALE=true\n`;
  }

  static getPathPrefixCases(): Array<any> {
    const job = getBuildJobDef();
    const itemValid = TestDataProvider.getPublishBranchesContent(job);

    // Null version
    const itemNullVersion = TestDataProvider.getPublishBranchesContent(job);
    itemNullVersion['branches'] = null;

    const itemPrefixEmpty = TestDataProvider.getPublishBranchesContent(job);
    itemPrefixEmpty.prefix = 'compass';

    return [
      {
        value: itemValid,
        pathPrefix: `${itemValid.prefix}/${job.payload.urlSlug}`,
        mutPrefix: `${itemValid.prefix}/${job.payload.urlSlug}`,
      },
      {
        value: itemNullVersion,
        pathPrefix: `${itemNullVersion.prefix}/${job.payload.urlSlug}`,
        mutPrefix: `${itemNullVersion.prefix}/${job.payload.urlSlug}`,
      },
      {
        value: itemPrefixEmpty,
        pathPrefix: `${itemPrefixEmpty.prefix}/${job.payload.urlSlug}`,
        mutPrefix: `${itemPrefixEmpty.prefix}/${job.payload.urlSlug}`,
      },
    ];
  }

  static getManifestPrefixCases(): Array<any> {
    const job = getBuildJobDef();
    const itemValid = TestDataProvider.getPublishBranchesContent(job);
    return [
      {
        branchInfo: itemValid,
        aliased: false,
        primaryAlias: 'DONTSET',
        alias: 'DONTSET',
        manifestPrefix: `${job.payload.repoName}-${job.payload.urlSlug}`,
      },
      {
        branchInfo: itemValid,
        aliased: true,
        primaryAlias: 'primary',
        alias: 'DONTSET',
        manifestPrefix: `${job.payload.repoName}-${job.payload.urlSlug}`,
      },
      {
        branchInfo: itemValid,
        aliased: true,
        primaryAlias: 'primary',
        alias: 'UsingAlias',
        manifestPrefix: `${job.payload.repoName}-UsingAlias`,
      },
      {
        branchInfo: itemValid,
        aliased: true,
        primaryAlias: null,
        alias: 'DONTSET',
        manifestPrefix: undefined,
      },
    ];
  }

  static getCommonDeployCommands(job: Job): Array<string> {
    return ['. /venv/bin/activate', `cd repos/${job.payload.repoName}`, 'make publish && make deploy'];
  }

  static getCommonDeployCommandsForStaging(job: Job): Array<string> {
    return ['. /venv/bin/activate', `cd repos/${job.payload.repoName}`, 'make stage'];
  }

  static getExpectedStageDeployNextGenCommands(job: Job): Array<string> {
    const genericCommands = TestDataProvider.getCommonDeployCommands(job);
    // TODO: simplify construction of return value
    if (job.payload.mutPrefix) {
      return Array<string>().concat(genericCommands.slice(0, genericCommands.length - 1), [
        `make next-gen-stage MUT_PREFIX=${job.payload.mutPrefix}`,
      ]);
    }
    return Array<string>().concat(genericCommands.slice(0, genericCommands.length - 1), [`make next-gen-stage`]);
  }

  static getExpectedProdDeployNextGenCommands(job: Job): Array<string> {
    const genericCommands = TestDataProvider.getCommonDeployCommands(job);
    // TODO: simplify construction of return value
    const ret = Array<string>().concat(genericCommands.slice(0, genericCommands.length - 1), [
      `make next-gen-deploy MUT_PREFIX=${job.payload.mutPrefix}`,
    ]);
    return ret;
  }

  static getPublishOutputWithPurgedUrls(prod: boolean): Array<any> {
    if (prod) {
      return [
        'Line1 \r\n Line2 \r\n {\t"urls": ["url1", "url2", "url3", "url4", "url5"]}',
        ['url1', 'url2', 'url3', 'url4', 'url5'],
      ];
    } else {
      return ['Line1 \r\n Line2 \r\n Summary: All good'];
    }
  }
  static nextGenEntryInWorkerFile() {
    return ['"build-and-stage-next-gen"'].join('/r/n');
  }

  static getStatusUpdateQueryAndUpdateObject(
    id: string,
    status: string,
    result: any,
    date: Date,
    error = false,
    reason = ''
  ): any {
    const retObj = {
      query: { _id: id },
      update: {
        $set: {
          status: status,
          endTime: date,
        },
      },
    };

    if (error) {
      retObj['update']['$set']['error'] = { time: new Date().toString(), reason: reason };
    } else {
      retObj['update']['$set']['result'] = result;
    }
    return retObj;
  }

  static getFindOneAndUpdateCallInfo(): any {
    return {
      query: {
        status: 'inQueue',
        createdTime: { $lte: new Date() },
      },
      update: { $set: { startTime: new Date(), status: 'inProgress' } },
      options: { sort: { priority: -1, createdTime: 1 }, returnNewDocument: true },
    };
  }

  static getInsertLogStatementInfo(id: string, messages: string[]): any {
    return {
      query: {
        _id: id,
      },
      update: {
        $push: { ['logs']: { $each: messages } },
      },
    };
  }

  static getInsertComMessageInfo(id: string, message: string): any {
    return {
      query: {
        _id: id,
      },
      update: {
        $push: { comMessage: message },
      },
    };
  }

  static getInsertPurgedUrls(id: string, urls: string[]): any {
    return {
      query: {
        _id: id,
      },
      update: {
        $push: { ['purgedURLs']: urls },
      },
    };
  }

  static getJobResetInfo(id: string, message: string): any {
    return {
      query: {
        _id: id,
      },
      update: {
        $set: {
          status: 'inQueue',
          startTime: null,
          error: {},
          logs: [message],
        },
      },
    };
  }

  static getRepoEntitlementsByGithubUsernameInfo(userName: string): any {
    return {
      query: { github_username: userName },
    };
  }

  static getRepoBranchesData(job: Job): any {
    return {
      repoName: job.payload.repoName,
      branches: [
        {
          name: job.payload.branchName,
          publishOriginalBranchNam: false,
          active: true,
          aliases: null,
          gitBranchName: job.payload.branchName,
          urlSlug: null,
          versionSelectorLabel: 'master',
          urlAliases: null,
          isStableBranch: true,
        },
      ],
      bucket: {
        regression: 'docs-atlas-stg',
        dev: 'docs-atlas-dev',
        stg: 'docs-atlas-stg',
        prd: 'docs-atlas-prd',
        dotcomstg: 'docs-atlas-dotcomstg',
        dotcomprd: 'docs-atlas-dotcomprd',
      },
      url: {
        regression: 'https://docs-atlas-integration.mongodb.com',
        dev: 'https://docs-atlas-staging.mongodb.com',
        stg: 'https://docs-atlas-staging.mongodb.com',
        prd: 'https://docs.atlas.mongodb.com',
      },
      prefix: '/',
      project: 'cloud-docs',
    };
  }

  static getRepoBranchesByRepoName(repoName: string): any {
    return {
      query: { repoName: repoName },
    };
  }

  static getCommandsForGetServerUser(): string[] {
    return [`whoami`];
  }

  static getPatchCommands(repoDirName: string, patchName: string): string[] {
    return [`cd repos/${repoDirName}`, `patch -p1 < ${patchName}`];
  }

  static getcheckoutBranchForSpecificHeadCommands(repoDirName: string, branchName: string, newHead: string): string[] {
    return [
      `cd repos/${repoDirName}`,
      `git fetch`,
      `git checkout ${branchName}`,
      `git branch ${branchName} --contains ${newHead}`,
    ];
  }

  static getPullRepoCommands(
    repoDirName: string,
    branchName: string,
    newHead: string | null | undefined = null
  ): string[] {
    const retVal = [`cd repos/${repoDirName}`, `git checkout ${branchName}`, `git pull origin ${branchName}`];

    if (newHead) {
      retVal.push(`git checkout ${newHead} .`);
    }
    return retVal;
  }

  static getAggregationPipeline(
    matchConditionField: string,
    matchConditionValue: string,
    projection?: { [k: string]: number }
  ) {
    return [
      // Stage 1: Unwind the repos array to create multiple documents for each referenced repo
      {
        $unwind: '$repos',
      },
      // Stage 2: Lookup to join with the repos_branches collection
      {
        $lookup: {
          from: 'repos_branches',
          localField: 'repos',
          foreignField: '_id',
          as: 'repo',
        },
      },
      // Stage 3: Match documents based on given field
      {
        $match: {
          [`repo.${matchConditionField}`]: matchConditionValue,
        },
      },
      // Stage 4: Merge/flatten repo into docset
      {
        $replaceRoot: { newRoot: { $mergeObjects: [{ $arrayElemAt: ['$repo', 0] }, '$$ROOT'] } },
      },
      // Stage 5: Exclude fields
      {
        $project: projection || {
          _id: 0,
          repos: 0,
          repo: 0,
        },
      },
    ];
  }
}
