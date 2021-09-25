import { MongoMemoryServer } from 'mongodb-memory-server';
import * as mongodb from "mongodb";
import { MongoMemoryServerStates } from 'mongodb-memory-server-core/lib/MongoMemoryServer';
const COLLECTIONS = ['queue', 'entitlements'];
export class TestDBManager {
  public db: mongodb.Db;
  public client: mongodb.MongoClient;
  protected server: MongoMemoryServer;
  constructor() {
    jest.setTimeout(60000);
    this.server = new MongoMemoryServer({
      instance: {
        dbName: 'jest'
      }
    });
    process.env.DB_NAME = 'jest';
    process.env.JOB_QUEUE_COL_NAME = 'queue'
    process.env.USER_ENTITLEMENT_COL_NAME = 'entitlements'
  }

  async start() {
    if (this.server.state == MongoMemoryServerStates.stopped || this.server.state == MongoMemoryServerStates.new) {
      await this.server.start();
    }
    const url = this.server.getUri();
    process.env.MONGO_ATLAS_URL = url;
    this.client = new mongodb.MongoClient(url);
    await this.client.connect();
    this.db = this.client.db(process.env.DB_NAME);
    await this.db.createCollection(process.env.JOB_QUEUE_COL_NAME);
    await this.db.createCollection(process.env.USER_ENTITLEMENT_COL_NAME);
  }

  async stop() {
    await this.client.close();
    await this.server.stop();
  }

  async cleanup() {
    return await Promise.all(COLLECTIONS.map((c) => this.db.collection(c).deleteMany({})));
  }

  async insertDocument(document: any, collection:string): Promise<any> {
    let resp = await this.db.collection(collection).insertOne(document);
    return resp.insertedId;
  }
  
  async findJob(id: any): Promise<any> {
    const query = { _id: id };
    console.log(query);
    return await this.db.collection(process.env.JOB_QUEUE_COL_NAME).findOne(query);
  }

}