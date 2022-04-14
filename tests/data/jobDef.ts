export default {
  value: {
    _id: '5c5e0817ce099eaf874a9801',
    title: 'Slack deploy: skerschb',
    user: 'skerschb',
    email: '32710906+skerschb@users.noreply.github.com',
    priority: 1,
    status: 'completed',
    createdTime: '2/8/2019 - 12:52 PM',
    startTime: '2/9/2019 - 12:32 PM',
    endTime: '2/9/2019 - 12:32 PM',
    error: {},
    result: [],
    invalidationStatusURL: '',
    payload: {
      jobType: 'productionDeploy',
      source: 'github',
      action: 'push',
      repoName: 'testauth',
      branchName: 'DOCSP-666',
      isFork: false,
      repoOwner: 'skerschb',
      url: 'https://github.com/skerschb/testauth.git',
      newHead: '38b805e9c7c4f1c364476682e93f9d24a87f470a',
      project: 'testauth',
      urlSlug: 'UsingAlias',
      prefix: 'compass',
    },
    logs: [],
  },
};

export const manifestJobDef = {
  value: {
    _id: '',
    buildCommands: [],
    deployCommands: [],
    endTime: undefined,
    error: undefined,
    logs: undefined,
    manifestPrefix: undefined,
    mutPrefix: undefined,
    pathPrefix: undefined,
    startTime: expect.any(Date),
    createdTime: expect.any(Date),
    email: '',
    comMessage: null,
    purgedUrls: null,
    shouldGenerateSearchManifest: false,
    payload: {
      action: 'push',
      branchName: 'DOCSP-666',
      isFork: false,
      isNextGen: true,
      jobType: 'manifestGeneration',
      manifestPrefix: 'testauth-UsingAlias',
      mutPrefix: 'compass/UsingAlias',
      newHead: '38b805e9c7c4f1c364476682e93f9d24a87f470a',
      pathPrefix: 'compass/UsingAlias',
      prefix: 'compass',
      project: 'testauth',
      repoName: 'testauth',
      repoOwner: 'skerschb',
      source: 'github',
      url: 'https://github.com/skerschb/testauth.git',
      urlSlug: 'UsingAlias',
    },
    priority: 2,
    result: undefined,
    status: null,
    title: 'Slack deploy: skerschb - search manifest generation',
    user: 'skerschb',
  },
};
