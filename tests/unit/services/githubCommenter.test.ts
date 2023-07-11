import { mockDeep, mockReset } from 'jest-mock-extended';
import { Octokit } from '@octokit/rest';
import { ILogger } from '../../../src/services/logger';
import { GithubCommenter } from '../../../src/services/github';

jest.mock('@octokit/rest');
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const MockedOctokit = Octokit as jest.Mock<typeof Octokit>;

let logger: ILogger;
let githubCommenter: GithubCommenter;

beforeEach(() => {
  logger = mockDeep<ILogger>();
  githubCommenter = new GithubCommenter(logger, 'gitHubToken');
});

afterEach(() => {
  mockReset(logger);
  jest.clearAllMocks();
});

const mockPayload = {
  jobType: 'productionDeploy',
  action: 'push',
  branchName: 'DOCSP-666',
  isFork: false,
  manifestPrefix: undefined,
  mutPrefix: undefined,
  newHead: '38b805e9c7c4f1c364476682e93f9d24a87f47ll',
  pathPrefix: undefined,
  prefix: 'atlas',
  project: 'cloud-docs',
  repoName: 'cloud-docs',
  repoOwner: 'mmeigs',
  source: 'github',
  url: 'https://github.com/mmeigs/cloud-docs.git',
  urlSlug: 'UsingAlias',
  private: true,
  isXlarge: true,
  patch: '',
  alias: '',
  aliased: false,
  primaryAlias: '',
  isNextGen: true,
  stable: true,
  includeInGlobalSearch: true,
  regression: false,
  repoBranches: [],
};

const expectedId = '0823hd8';
const expectedPRNumbers = [31, 32];

const mockOctokitRequest = jest.fn(
  (url: string, options?: { owner: string; repo: string; issue_number: number }) =>
    new Promise((resolve, reject) => {
      if (url.match(/^GET.*pulls$/))
        resolve({ data: [{ number: expectedPRNumbers[0] }, { number: expectedPRNumbers[1] }] });
      else if (url.match(/^GET.*comments$/) && options?.issue_number === 1)
        resolve({ data: [{ id: expectedId, user: { login: 'docs-builder-bot' } }] });
      else if (url.match(/^GET.*comments$/)) resolve({ data: [{ id: expectedId, user: { login: 'mickey-mouse' } }] });
      else if (url.match(/^POST.*comments$/)) resolve('success');
      else if (url.match(/^GET.*{comment_id}$/)) resolve({ data: { body: 'BODY' } });
      else if (url.match(/^PATCH.*{comment_id}$/)) resolve('success');
    })
);
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
MockedOctokit.mockImplementation(() => ({ request: mockOctokitRequest }));

describe('GithubCommenter Tests', () => {
  test('GithubCommenter constructor', () => {
    expect(githubCommenter).toBeDefined();
  });

  describe('getParentPRs', () => {
    test('getParentPRs succeeds', async () => {
      const response = await githubCommenter.getParentPRs(mockPayload);
      expect(mockOctokitRequest).toBeCalledWith('GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls', {
        owner: mockPayload.repoOwner,
        repo: mockPayload.repoName,
        commit_sha: mockPayload.newHead,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      expect(response).toHaveLength(expectedPRNumbers.length);
      expect(response[0]).toBe(expectedPRNumbers[0]);
      expect(response[1]).toBe(expectedPRNumbers[1]);
    });

    test('getParentPRs fails with undefined newHead', async () => {
      expect(githubCommenter.getParentPRs({ ...mockPayload, newHead: undefined })).rejects.toThrow();
    });
  });

  describe('getPullRequestCommentId', () => {
    test('getPullRequestCommentId succeeds', async () => {
      const response = await githubCommenter.getPullRequestCommentId(mockPayload, 1);
      expect(mockOctokitRequest).toBeCalledWith('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        owner: mockPayload.repoOwner,
        repo: mockPayload.repoName,
        issue_number: 1,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      expect(response).toBe(expectedId);
    });

    test('getPullRequestCommentId fails', async () => {
      const response = await githubCommenter.getPullRequestCommentId(mockPayload, 66);
      expect(response).toBeUndefined();
    });
  });

  describe('postComment', () => {
    test('postComment succeeds', async () => {
      const response = await githubCommenter.postComment(mockPayload, 1, '');
      expect(mockOctokitRequest).toBeCalledWith('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        owner: mockPayload.repoOwner,
        repo: mockPayload.repoName,
        issue_number: 1,
        body: ``,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      expect(response).toBe(201);
    });
  });

  describe('updateComment', () => {
    it('updateComment succeeds', async () => {
      const comment = 'COMMENT';
      const comment_id = 1002;
      const response = await githubCommenter.updateComment(mockPayload, comment_id, comment);
      expect(mockOctokitRequest).toHaveBeenNthCalledWith(1, 'GET /repos/{owner}/{repo}/issues/comments/{comment_id}', {
        owner: mockPayload.repoOwner,
        repo: mockPayload.repoName,
        comment_id,
      });
      expect(mockOctokitRequest).toHaveBeenNthCalledWith(
        2,
        'PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}',
        {
          owner: mockPayload.repoOwner,
          repo: mockPayload.repoName,
          comment_id,
          body: 'BODY' + `\n${comment}`,
        }
      );
      expect(response).toBe(200);
    });
  });
});
