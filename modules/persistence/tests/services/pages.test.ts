import { Db, MongoClient } from 'mongodb';
import { Page, UpdatedPage, _updatePages } from '../../src/services/pages';
import { closeDb, setMockDB } from '../utils';
import { ObjectID } from 'bson';

let connection: MongoClient;
let mockDb: Db;

jest.mock('../../src/services/connector', () => {
  return {
    db: jest.fn(() => {
      return mockDb;
    }),
    // Mock bulkWrite function as it attemps to grab the original db implementation
    // instead of the mockDb
    bulkWrite: jest.fn((operations, collection) => {
      return mockDb.collection(collection).bulkWrite(operations);
    }),
  };
});

describe('pages module', () => {
  beforeAll(async () => {
    [mockDb, connection] = await setMockDB();
  });

  afterAll(async () => {
    await closeDb(mockDb, connection);
  });

  describe('updatePages', () => {
    const collection = 'updated_documents';

    const generatePagePrefix = () => {
      const uniqueBranch = new ObjectID().toString();
      return `docs/docsworker-xlarge/${uniqueBranch}`;
    };

    const generatePages = (pagePrefix: string): Page[] => {
      return [
        {
          page_id: `${pagePrefix}/page0.txt`,
          filename: 'page0.txt',
          ast: { foo: 'foo', bar: { foo: 'foo' } },
          static_assets: [],
        },
        {
          page_id: `${pagePrefix}/page1.txt`,
          filename: 'page1.txt',
          ast: { foo: 'foo', bar: { foo: 'bar' } },
          static_assets: [],
        },
      ];
    };

    it('should insert new pages', async () => {
      const pagePrefix = generatePagePrefix();
      const findQuery = {
        page_id: { $regex: new RegExp(`^${pagePrefix}`) },
      };
      let res = await mockDb.collection(collection).find(findQuery).toArray();
      expect(res).toHaveLength(0);

      const pages = generatePages(pagePrefix);
      // reStructuredText files should not be inserted
      const rstFile = {
        page_id: `${pagePrefix}/includes/included-file.rst`,
        filename: 'includes/included-file.rst',
        ast: { foo: 'foo', bar: { foo: 'foo' } },
        static_assets: [],
      };
      pages.push(rstFile);
      await _updatePages(pages, collection);

      res = await mockDb.collection(collection).find(findQuery).toArray();
      expect(res).toHaveLength(2);
      const foundRstFile = res.find(({ filename }) => filename === rstFile.filename);
      expect(foundRstFile).toBeFalsy();
    });

    it('should update modified pages', async () => {
      const pagePrefix = generatePagePrefix();
      const pages = generatePages(pagePrefix);
      await _updatePages(pages, collection);

      const findQuery = {
        page_id: { $regex: new RegExp(`^${pagePrefix}`) },
      };
      let res = await mockDb.collection<UpdatedPage>(collection).find(findQuery).toArray();
      expect(res).toHaveLength(2);
      // Page documents should have been updated at the same time at time of insert
      expect(res[0].updated_at.toString() === res[1].updated_at.toString()).toBeTruthy();

      // Only page1 should have an update
      const updatedPages: Page[] = [
        {
          page_id: `${pagePrefix}/page0.txt`,
          filename: 'page0.txt',
          ast: { foo: 'foo', bar: { foo: 'foo' } },
          static_assets: [],
        },
        {
          page_id: `${pagePrefix}/page1.txt`,
          filename: 'page1.txt',
          ast: { foo: 'foo', bar: { foo: 'baz' } },
          static_assets: [],
        },
      ];
      await _updatePages(updatedPages, collection);

      res = await mockDb.collection<UpdatedPage>(collection).find(findQuery).toArray();
      expect(res).toHaveLength(2);
      const updatedPage = res.find(({ filename }) => filename === 'page1.txt');
      expect(updatedPage).toHaveProperty('ast.bar.foo', 'baz');
      // Page documents should have different timestamps to denote different update times
      expect(res[0].updated_at !== res[1].updated_at).toBeTruthy();
    });

    it('should mark pages for deletion', async () => {
      const pagePrefix = generatePagePrefix();
      const pages = generatePages(pagePrefix);
      await _updatePages(pages, collection);

      const findQuery = {
        page_id: { $regex: new RegExp(`^${pagePrefix}`) },
        deleted: true,
      };
      let res = await mockDb.collection(collection).find(findQuery).toArray();
      expect(res).toHaveLength(0);

      const updatedPages = [
        { page_id: `${pagePrefix}/page1.txt`, filename: 'page1.txt', ast: { foo: 'foo', bar: { foo: 'bar' } } },
      ];
      await _updatePages(updatedPages, collection);

      // There should be 1 page marked as deleted
      res = await mockDb.collection(collection).find(findQuery).toArray();
      expect(res).toHaveLength(1);
      expect(res[0]).toHaveProperty('filename', 'page0.txt');

      // Re-adding the deleted page should lead to no deleted pages
      await _updatePages(pages, collection);
      res = await mockDb.collection(collection).find(findQuery).toArray();
      expect(res).toHaveLength(0);
    });

    describe('static assets', () => {
      const sampleStaticAssets = [
        { checksum: '1234567890', key: '/images/new-asset.png' },
        { checksum: '0987654321', key: '/images/another-new-asset.png' },
      ];

      const createSamplePage = (pagePrefix: string, withAssets?: boolean) => {
        const samplePage: Page = {
          page_id: `${pagePrefix}/page0.txt`,
          filename: 'page0.txt',
          ast: { foo: 'foo', bar: { foo: 'foo' } },
          static_assets: [],
        };

        if (withAssets) {
          samplePage.static_assets = sampleStaticAssets;
        }

        return samplePage;
      };

      it('should return empty assets when there are no assets', async () => {
        // Setup for empty static assets
        const pagePrefix = generatePagePrefix();
        const page = createSamplePage(pagePrefix);
        await _updatePages([page], collection);

        const findQuery = { page_id: page.page_id };
        let res = await mockDb.collection<UpdatedPage>(collection).findOne(findQuery);
        expect(res).toBeTruthy();
        expect(res!.static_assets).toHaveLength(0);

        // Simulate update in page
        page.ast.foo = 'foobar';
        await _updatePages([page], collection);
        res = await mockDb.collection<UpdatedPage>(collection).findOne(findQuery);
        expect(res).toBeTruthy();
        // Should still be 0
        expect(res!.static_assets).toHaveLength(0);
      });

      it('should add new assets', async () => {
        // Setup for empty static assets
        const pagePrefix = generatePagePrefix();
        const page = createSamplePage(pagePrefix);
        await _updatePages([page], collection);

        // Modify page with new AST; a change in static_assets implies a change in AST
        page.ast.foo = 'new assets';
        page.static_assets = sampleStaticAssets;
        const numStaticAssets = page.static_assets.length;
        await _updatePages([page], collection);

        // Check that both assets were added
        const findQuery = { page_id: page.page_id };
        const res = await mockDb.collection<UpdatedPage>(collection).findOne(findQuery);
        expect(res).toBeTruthy();
        expect(res!.static_assets).toHaveLength(numStaticAssets);
        expect(res!.static_assets[0].updated_at).toBeTruthy();
        expect(res!.static_assets[1].updated_at).toBeTruthy();
      });

      it('should keep assets the same when no assets are changed', async () => {
        const pagePrefix = generatePagePrefix();
        const page = createSamplePage(pagePrefix, true);
        await _updatePages([page], collection);

        // Check that static assets were saved
        const findQuery = { page_id: page.page_id };
        let res = await mockDb.collection<UpdatedPage>(collection).findOne(findQuery);
        expect(res).toBeTruthy();
        const prevStaticAssets = res!.static_assets;

        // Simulate change in AST but not in static assets
        page.ast.foo = 'no change in assets';
        await _updatePages([page], collection);

        // Check to make sure no changes in static assets
        res = await mockDb.collection<UpdatedPage>(collection).findOne(findQuery);
        expect(res).toBeTruthy();
        expect(res!.static_assets).toEqual(prevStaticAssets);
      });

      it('should mark updated assets when there is a change in existing asset', async () => {
        const pagePrefix = generatePagePrefix();
        const page = createSamplePage(pagePrefix, true);
        const originalKey = page.static_assets[1].key;
        const numStaticAssets = page.static_assets.length;
        await _updatePages([page], collection);

        // Check to make sure asset we plan to change was successfully added
        const findQuery = { page_id: page.page_id };
        let res = await mockDb.collection<UpdatedPage>(collection).findOne(findQuery);
        expect(res).toBeTruthy();
        const originalAsset = res!.static_assets.find(({ key }) => key === originalKey);
        expect(originalAsset).toBeTruthy();

        // Modify page with new AST; a change in static_assets implies a change in AST
        page.ast.foo = 'change in one asset';
        const changedKey = '/images/changed-asset-name.svg';
        page.static_assets[1].key = changedKey;
        await _updatePages([page], collection);

        // Make sure changed asset is different from original asset
        res = await mockDb.collection<UpdatedPage>(collection).findOne(findQuery);
        expect(res).toBeTruthy();
        expect(res!.static_assets).toHaveLength(numStaticAssets);
        const updatedAsset = res!.static_assets.find(({ key }) => key === changedKey);
        expect(updatedAsset).toBeTruthy();
        expect(updatedAsset!.checksum).toEqual(originalAsset!.checksum);
        if (updatedAsset?.updated_at && originalAsset?.updated_at) {
          expect(updatedAsset.updated_at.getTime()).toBeGreaterThan(originalAsset.updated_at.getTime());
        }
      });

      it('should not include deleted assets', async () => {
        // Setup for single static asset
        const pagePrefix = generatePagePrefix();
        const page = createSamplePage(pagePrefix, true);
        await _updatePages([page], collection);

        page.ast.foo = 'deleted assets';
        page.static_assets = [];
        await _updatePages([page], collection);

        const findQuery = { page_id: page.page_id };
        const res = await mockDb.collection<UpdatedPage>(collection).findOne(findQuery);
        expect(res).toBeTruthy();
        expect(res!.static_assets).toHaveLength(0);
      });
    });
  });
});
