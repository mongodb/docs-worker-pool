
import { Db, Collection } from 'mongodb';
import { DBError } from '../errors/errors';
import { ILogger } from '../services/logger';

export abstract class BaseRepository<T> {
    protected   _collectionName: string;
    protected _logger: ILogger;
    protected _repoName: string;

    constructor(db: Db, collectionName: string, logger: ILogger) {
        this._collectionName = db.collection(collectionName);
        this._logger = logger;
    }

    async findOne(query: any): Promise<any> {
        return await this._collection.findOne(query);
    }
    async updateOne(query: any, update: any): Promise<boolean> {
        let updateResult = await this._collection.updateOne(query, update);
        if (updateResult.result.n < 1) {
            this._logger.error(`[${this._repoName}:updateOne]`, `Failed to update job (${JSON.stringify(query)})  for ${JSON.stringify(update)}`);
            throw new DBError(`Failed to update job (${query})  for ${update}`);
        }
        return true
    }
    async findOneAndUpdate(query: any, update: any, options: any): Promise<any> {
        try {
            return await this._collection.findOneAndUpdate(query, update, options);
        } catch (error) {
            this._logger.error(`[${this._repoName}:findOneAndUpdate]`, `Failed to update job (${JSON.stringify(query)})  for ${JSON.stringify(update)}`);
            throw new DBError(error);
        }
        
    }
}
