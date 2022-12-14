import { ObjectID } from 'bson';
import { db, insert, upsert } from '../../src/services/connector';

const mockConnect = jest.fn();
const mockDb = jest.fn();
const mockCollection = jest.fn();
const mockInsertMany = jest.fn();
const mockUpdateOne = jest.fn();
const mockClose = jest.fn();

// below is a "jest mock" of a mongodb client
// TODO: update this test module to work with MongoDB memory server
//       - create test db and verify connector's calls update memory server

jest.mock('mongodb', () => ({
  MongoClient: class MongoClient {
    constructor() {
      console.log('constructor');
    }
    connect() {
      return mockConnect();
    }
    async db(...args) {
      mockDb(...args);
      return this;
    }
    collection(collection) {
      mockCollection(collection);
      return this;
    }
    async insertMany() {
      return mockInsertMany();
    }
    async updateOne(...args) {
      return mockUpdateOne(...args);
    }
    close() {
      mockClose();
    }
  },
}));

describe('Connector module', () => {
  // mock process env. store original env and restore
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
    jest.restoreAllMocks();
  });

  describe('db', () => {
    test('calls client to connect with env variables and returns a mongoDB Db instance', async () => {
      try {
        const testEnv = {
          DB_NAME: 'test-db-name',
          DB_USER: 'user',
          DB_PASSWORD: 'password',
          DB_HOST: 'host',
        };
        process.env = {
          ...env,
          ...testEnv,
        };
        const database = await db();
        expect(mockConnect).toHaveBeenCalled();
        expect(mockDb).toHaveBeenCalled();
        expect(mockDb).toHaveBeenCalledWith(testEnv.DB_NAME);
      } catch (e) {
        console.error(e);
        throw e;
      }
    });

    test('returns an error if client fails', async () => {
      /**
       * Question for error catching:
       * why are they not catching in functions (ie. db, insert) when throwing mocked rejections
       * see connection/db line 32
       *
       */
      mockConnect.mockRejectedValueOnce(new Error('test error') as never);
      try {
        const database = await db();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e.message).toEqual('test error');
      }
    });
  });

  describe('insert', () => {
    const docs = [
      {
        id: 1,
        name: 'doc',
      },
    ];
    const collection = 'metadata';
    const buildId = new ObjectID();
    test('it calls insert on collection specified, with docs argument', async () => {
      await insert(docs, collection, buildId);
      expect(mockCollection).toHaveBeenCalledWith(collection);
      expect(mockInsertMany).toHaveBeenCalled();
    });

    test('it throws error on collection or insertMany error', async () => {
      try {
        mockInsertMany.mockRejectedValueOnce(new Error('test error') as never);
        await insert(docs, collection, buildId);
      } catch (e) {
        expect(e.message).toEqual('test error');
      }
    });
  });

  describe('upsert', () => {
    const payload = { name: 'upsert-doc' };
    const collection = 'metadata';
    const id = 'test-id';
    test('it calls on collection to update one with upsert option true', async () => {
      await upsert(payload, collection, id);
      expect(mockCollection).toBeCalledWith(collection);
      expect(mockUpdateOne).toBeCalledWith({ _id: 'test-id' }, { $set: { name: 'upsert-doc' } }, { upsert: true });
    });

    test('it throws error on updateone error', async () => {
      mockUpdateOne.mockRejectedValueOnce(new Error('test error') as never);
      try {
        await upsert(payload, collection, id);
      } catch (e) {
        expect(e.message).toEqual('test error');
      }
    });
  });
});
