import { Db, MongoClient } from 'mongodb';
import { UpdatedPage, updatePages } from '../../src/services/pages';
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

    const generatePages = (pagePrefix) => {
      return [
        { page_id: `${pagePrefix}/page0.txt`, filename: 'page0.txt', ast: { foo: 'foo', bar: { foo: 'foo' } } },
        { page_id: `${pagePrefix}/page1.txt`, filename: 'page1.txt', ast: { foo: 'foo', bar: { foo: 'bar' } } },
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
      };
      pages.push(rstFile);
      await updatePages(pages, collection);

      res = await mockDb.collection(collection).find(findQuery).toArray();
      expect(res).toHaveLength(2);
      const foundRstFile = res.find(({ filename }) => filename === rstFile.filename);
      expect(foundRstFile).toBeFalsy();
    });

    it('should update modified pages', async () => {
      const pagePrefix = generatePagePrefix();
      const pages = generatePages(pagePrefix);
      await updatePages(pages, collection);

      const findQuery = {
        page_id: { $regex: new RegExp(`^${pagePrefix}`) },
      };
      let res = await mockDb.collection<UpdatedPage>(collection).find(findQuery).toArray();
      expect(res).toHaveLength(2);
      // Page documents should have been updated at the same time at time of insert
      expect(res[0].updated_at.toString() === res[1].updated_at.toString()).toBeTruthy();

      // Only page1 should have an update
      const updatedPages = [
        { page_id: `${pagePrefix}/page0.txt`, filename: 'page0.txt', ast: { foo: 'foo', bar: { foo: 'foo' } } },
        { page_id: `${pagePrefix}/page1.txt`, filename: 'page1.txt', ast: { foo: 'foo', bar: { foo: 'baz' } } },
      ];
      await updatePages(updatedPages, collection);

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
      await updatePages(pages, collection);

      const findQuery = {
        page_id: { $regex: new RegExp(`^${pagePrefix}`) },
        deleted: true,
      };
      let res = await mockDb.collection(collection).find(findQuery).toArray();
      expect(res).toHaveLength(0);

      const updatedPages = [
        { page_id: `${pagePrefix}/page1.txt`, filename: 'page1.txt', ast: { foo: 'foo', bar: { foo: 'bar' } } },
      ];
      await updatePages(updatedPages, collection);

      // There should be 1 page marked as deleted
      res = await mockDb.collection(collection).find(findQuery).toArray();
      expect(res).toHaveLength(1);
      expect(res[0]).toHaveProperty('filename', 'page0.txt');

      // Re-adding the deleted page should lead to no deleted pages
      await updatePages(pages, collection);
      res = await mockDb.collection(collection).find(findQuery).toArray();
      expect(res).toHaveLength(0);
    });
  });
});
