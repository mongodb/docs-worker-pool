import { MongoClient } from 'mongodb';

export interface IDBConnector {
    updateOne(): Promise<any>
    findOneAndUpdate(): Promise<any>
}

export class AtlasConnector implements IDBConnector {
    updateOne(): Promise<any> {
        throw new Error('Method not implemented.');
    }
    findOneAndUpdate(): Promise<any> {
        throw new Error('Method not implemented.');
    }

}