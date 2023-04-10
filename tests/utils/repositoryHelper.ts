import { IConfig } from 'config';
import { mockDeep } from 'jest-mock-extended';
import { Db, FindCursor, FindOptions } from 'mongodb';
import { JobRepository } from '../../src/repositories/jobRepository';
import { RepoEntitlementsRepository } from '../../src/repositories/repoEntitlementsRepository';
import { RepoBranchesRepository } from '../../src/repositories/repoBranchesRepository';
import { ILogger } from '../../src/services/logger';

export class DBRepositoryHelper {
  config: IConfig;
  logger: ILogger;
  db: Db;
  updateOne: (query: any, update: any, errorMsg: string) => Promise<boolean>;
  updateMany: (query: any, update: any, errorMsg: string) => Promise<boolean>;
  find: (query: any, errorMsg: string, options?: FindOptions) => Promise<FindCursor>;
  findOne: (query: any, errorMsg: string) => Promise<any>;
  findOneAndUpdate: (query: any, update: any, options: any, errorMsg: string) => Promise<any>;
  collection: any;
  jobRepo: JobRepository;

  repoMapper = {
    job: JobRepository,
    repo: RepoEntitlementsRepository,
    repoBranches: RepoBranchesRepository,
  };

  init(repoName, collectionConfigName, collectionName): any {
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date(2021, 4, 3));
    this.config = mockDeep<IConfig>();
    this.logger = mockDeep<ILogger>();
    this.db = mockDeep<Db>();
    this.updateOne = jest.fn();
    this.updateMany = jest.fn();
    this.find = jest.fn();
    this.findOne = jest.fn();
    this.findOneAndUpdate = jest.fn();
    this.collection = {
      updateOne: this.updateOne,
      updateMany: this.updateMany,
      find: this.find,
      findOne: this.findOne,
      findOneAndUpdate: this.findOneAndUpdate,
    };
    this.config.get.calledWith(collectionConfigName).mockReturnValue(collectionName);
    this.db.collection.calledWith(collectionName).mockReturnValue(this.collection);
    this.jobRepo = new this.repoMapper[repoName](this.db, this.config, this.logger);
    return this.jobRepo;
  }
}
