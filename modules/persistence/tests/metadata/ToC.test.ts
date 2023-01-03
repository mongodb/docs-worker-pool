import { MongoClient } from 'mongodb';
import { AssociatedProduct, SharedMetadata } from '../../src/services/metadata/associated_products';
import {
  ToC,
  ToCInsertions,
  TocOrderInsertions,
  traverseAndMerge,
  _isInsertionCandidateNode,
} from '../../src/services/metadata/ToC';

import metadata from '../data/metadata.json';
import repoBranches from '../data/repos_branches.json';

let connection;
let mockDb;
jest.mock('../../src/services/connector', () => {
  return {
    pool: jest.fn(() => {
      return mockDb;
    }),
    db: jest.fn(() => {
      return mockDb;
    }),
  };
});

describe('ToC module', () => {
  beforeAll(async () => {
    // process.env.MONGO_URL defaults to localhost
    // https://github.com/shelfio/jest-mongodb#3-configure-mongodb-client
    // or update jest-mongodb-config.js
    try {
      connection = await MongoClient.connect(process.env.MONGO_URL || 'test');
      mockDb = await connection.db();
      mockDb.collection('repos_branches').insertMany(repoBranches);
      mockDb.collection('metadata').insertMany(metadata);
    } catch (e) {
      console.error(e);
    }
  });

  afterAll(async () => {
    await mockDb.collection('repos_branches').deleteMany({});
    await mockDb.collection('metadata').deleteMany({});
    await connection.close();
  });

  describe('isInsertionCandidateNode', () => {
    const associatedProducts = metadata
      .map((m) => m.associated_products || [])
      .flat() as unknown as AssociatedProduct[];
    function findTargetToc(tocList: ToC[], returnCandidate = true) {
      const targetToc = tocList.reduce((acc: ToC | undefined, toc) => {
        if (acc) return acc;
        if (!returnCandidate && !toc?.options?.project) return toc;
        if (toc?.options?.project) return toc;
        return findTargetToc(toc.children);
      }, undefined);
      return targetToc;
    }
    test('it returns true only if node is an insertion candiate', () => {
      let candidate;
      for (let metadataIdx = 0; metadataIdx < metadata.length; metadataIdx++) {
        if (candidate) break;
        candidate = findTargetToc([metadata[metadataIdx].toctree as unknown as ToC]);
      }
      expect(_isInsertionCandidateNode(candidate, associatedProducts)).toBeTruthy();
    });

    test('it returns false if node is not an associated product, or node has children', () => {
      let candidate;
      for (let metadataIdx = 0; metadataIdx < metadata.length; metadataIdx++) {
        if (candidate) break;
        candidate = findTargetToc([metadata[metadataIdx].toctree as unknown as ToC], false);
      }
      expect(_isInsertionCandidateNode(candidate, associatedProducts)).toBeFalsy();
    });
  });

  describe('traverseAndMerge', () => {
    it('searches BFS through the ToC tree from metadata, inserts matching tocInsertions and tocOrders', () => {
      const umbrellaMetadata = metadata[2];
      const tocInsertions = {
        'atlas-cli': {
          master: metadata[0].toctree,
        },
      } as unknown as ToCInsertions;
      const tocOrderInsertions = {
        'atlas-cli': {
          master: [
            '/',
            '/',
            'install-atlas-cli',
            'compatibility',
            'connect-atlas-cli',
            'atlas-cli-save-connection-settings',
            'atlas-cli-env-variables',
            'migrate-to-atlas-cli',
            'configure-optional-settings',
            'telemetry',
            'atlas-cli-tutorials',
            'atlas-cli-getting-started',
            'atlas-cli-quickstart',
            'reference',
            'cluster-config-file',
            'atlas-cli-changelog',
          ],
        },
      } as TocOrderInsertions;
      // console.log(traverseAndMerge(umbrellaMetadata as unknown as SharedMetadata, tocInsertions, tocOrderInsertions));

      expect(
        traverseAndMerge(umbrellaMetadata as unknown as SharedMetadata, tocInsertions, tocOrderInsertions)
      ).toMatchSnapshot();
    });
  });
});
