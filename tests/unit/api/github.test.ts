import * as mongodb from 'mongodb';
import { createSha256Signature } from '../../utils/createSha256Signature';
import { MarkBuildArtifactsForDeletion } from '../../../api/controllers/v1/github';
import { createMockAPIGatewayEvent } from '../../utils/createMockAPIGatewayEvent';

const DELETION_SECRET = 'GH_DELETION_SECRET';

// Mock RepoBranchesRepository so that we can mock which data to return.
jest.mock('../../../src/repositories/repoBranchesRepository', () => ({
  RepoBranchesRepository: jest.fn().mockImplementation(() => ({
    getProjectByRepoName: jest.fn().mockImplementation((repoName) => repoName),
  })),
}));

// Mock MetadataRepository so that we can mock which data to return.
jest.mock('../../../src/repositories/metadataRepository', () => ({
  MetadataRepository: jest.fn().mockImplementation(() => ({
    markMetadataForDeletion: jest.fn(),
  })),
}));

// Mock UpdatedDocsRepository so that we can mock which data to return.
jest.mock('../../../src/repositories/updatedDocsRepository', () => ({
  UpdatedDocsRepository: jest.fn().mockImplementation(() => ({
    markAstsForDeletion: jest.fn(),
  })),
}));

jest.mock('config', () => ({
  get: () => DELETION_SECRET,
}));

describe('GitHub API Tests', () => {
  describe('Artifact deletions', () => {
    // Subset of data needed by the webhook. GH provides a lot more info.
    const successfulPayload = {
      action: 'closed',
      pull_request: {
        user: {
          login: 'test-user',
        },
        head: {
          ref: 'test-webhook',
        },
      },
      repository: {
        name: 'docs-landing',
      },
    };

    beforeAll(() => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      jest.spyOn(mongodb, 'MongoClient').mockReturnValue({
        connect: jest.fn(),
        db: jest.fn(),
        close: jest.fn(),
      });
    });

    test('successfully marks documents for deletion', async () => {
      const payloadString = JSON.stringify(successfulPayload);
      const signature = createSha256Signature(payloadString, DELETION_SECRET, 'sha256=');
      const headers = {
        'X-GitHub-Event': 'pull_request',
        'X-Hub-Signature-256': signature,
      };
      const res = await MarkBuildArtifactsForDeletion(createMockAPIGatewayEvent(payloadString, headers));
      expect(res.statusCode).toBe(200);
    });

    test('invalid signatures gracefully error', async () => {
      const payloadString = JSON.stringify(successfulPayload);
      const signature = createSha256Signature(payloadString, 'NOT_GH_DELETION_SECRET', 'sha256=');
      const headers = {
        'X-GitHub-Event': 'pull_request',
        'X-Hub-Signature-256': signature,
      };
      const res = await MarkBuildArtifactsForDeletion(createMockAPIGatewayEvent(payloadString, headers));
      expect(res.statusCode).toBe(401);
    });

    test('invalid payloads gracefully error', async () => {
      // Wrong action
      const invalidPayload = { action: 'opened' };
      const payloadString = JSON.stringify(invalidPayload);
      const signature = createSha256Signature(payloadString, DELETION_SECRET, 'sha256=');
      const headers = {
        'X-GitHub-Event': 'pull_request',
        'X-Hub-Signature-256': signature,
      };
      const res = await MarkBuildArtifactsForDeletion(createMockAPIGatewayEvent(payloadString, headers));
      expect(res.statusCode).toBe(400);
    });

    test('invalid GH event gracefully error', async () => {
      const payloadString = JSON.stringify(successfulPayload);
      const signature = createSha256Signature(payloadString, DELETION_SECRET);
      const headers = {
        'X-GitHub-Event': 'ping',
        'X-Hub-Signature-256': signature,
      };
      const res = await MarkBuildArtifactsForDeletion(createMockAPIGatewayEvent(payloadString, headers));
      expect(res.statusCode).toBe(400);
    });
  });
});
