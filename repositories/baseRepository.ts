
import { IConfig } from 'config';
import { Db, Collection } from 'mongodb';
import { DBError } from '../errors/errors';
import { ILogger } from '../services/logger';

export abstract class BaseRepository<T> {
    private readonly _collection: Collection;
    protected _logger: ILogger;
    protected _repoName: string;
    protected _config : IConfig;

    constructor(db: Db, config: IConfig, logger: ILogger) {
        this._collection = db.collection(config.get("jobQueueCollection"));
        this._logger = logger;
        this._config = config;
    }

    private promiseTimeoutS(seconds, promise, errMsg) {
        const timeout = new Promise((resolve, reject) => {
          const id = setTimeout(() => {
            clearTimeout(id);
            reject(new DBError(`${errMsg} --> Timed out in ${seconds} seconds.`));
          }, 1000 * seconds);
        });
        return Promise.race([promise, timeout]);
      }

    async findOne(query: any,  erroMsg:string): Promise<any> { 
        try {
            return await this.promiseTimeoutS(this._config.get("MONGO_TIMEOUT_S"),this._collection.findOne(query), erroMsg);
        } catch (error) {
            this._logger.error(`[${this._repoName}:findOne]`, error.message);
            throw error;
        }
    }
    async updateOne(query: any, update: any, erroMsg:string): Promise<boolean> {
        try {
            let updateResult = await this.promiseTimeoutS(this._config.get("MONGO_TIMEOUT_S"),this._collection.updateOne(query, update), erroMsg);
            if (updateResult.result.n < 1) {
                this._logger.error(`[${this._repoName}:updateOne]`, `Failed to update job (${query})  for ${update}`);
                throw new DBError(`Failed to update job (${query})  for ${update}`);
            }
        } catch (error) {
            this._logger.error(`[${this._repoName}:findOneAndUpdate]`, error.message);
            throw error;
        }
        return true;
    }
    async findOneAndUpdate(query: any, update: any, options: any, errorMsg:string): Promise<any> {
        try {
            return await this.promiseTimeoutS( this._config.get("MONGO_TIMEOUT_S"), this._collection.findOneAndUpdate(query, update, options), errorMsg);
        } catch (error) {
            this._logger.error(`[${this._repoName}:findOneAndUpdate]`, error.message);
            throw error;
        }
        
    }
}
