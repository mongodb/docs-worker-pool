import { Job, Payload, JobStatus } from '../../src/entities/job';

// This wrapper function allows us to use nifty Jest features (which sadly cannot
// be used as mock function return values, so we have both)
export const getBuildJobDef = (): Job =>
  Object.assign(getBuildJobPlain(), {
    endTime: expect.any(Date),
    startTime: expect.any(Date),
    status: expect.any(JobStatus),
  });

// This is a function to get around object state change errors in tests
export const getBuildJobPlain = (): Job => ({
  _id: '5c5e0817ce099eaf874a9801',
  title: 'Slack deploy: skerschb',
  buildCommands: [],
  comMessage: null,
  createdTime: new Date('2022-04-20T17:10:09.432Z'),
  deployCommands: [],
  email: '32710906+skerschb@users.noreply.github.com',
  endTime: new Date('2022-04-20T17:10:09.432Z'),
  error: {},
  invalidationStatusURL: 'test-status-url',
  logs: [],
  priority: 1,
  purgedUrls: null,
  result: [],
  shouldGenerateSearchManifest: true,
  startTime: new Date('2022-04-20T17:10:09.432Z'),
  status: JobStatus.completed,
  user: 'skerschb',
  payload: {
    jobType: 'productionDeploy',
    action: 'push',
    branchName: 'DOCSP-666',
    isFork: false,
    manifestPrefix: undefined,
    mutPrefix: undefined,
    newHead: '38b805e9c7c4f1c364476682e93f9d24a87f470a',
    pathPrefix: undefined,
    prefix: 'compass',
    project: 'testauth',
    repoName: 'testauth',
    repoOwner: 'skerschb',
    source: 'github',
    url: 'https://github.com/skerschb/testauth.git',
    urlSlug: 'UsingAlias',
  } as Payload,
});

// Represents a manifestJob at time of insert to queue
export const getManifestJobDef = (): Omit<Job, '_id'> => ({
  buildCommands: [],
  comMessage: [],
  createdTime: expect.any(Date),
  deployCommands: [],
  email: '',
  endTime: null,
  error: null,
  invalidationStatusURL: '',
  logs: [],
  priority: 1,
  purgedUrls: [],
  result: null,
  shouldGenerateSearchManifest: false,
  startTime: expect.any(Date),
  status: JobStatus.inQueue,
  title: 'Slack deploy: skerschb - search manifest generation',
  user: 'skerschb',
  payload: {
    jobType: 'manifestGeneration',
    action: 'push',
    branchName: 'DOCSP-666',
    isFork: false,
    isNextGen: true,
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
  } as Payload,
});
