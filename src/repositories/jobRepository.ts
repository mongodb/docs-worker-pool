import * as mongodb from 'mongodb';
import { BaseRepository } from './baseRepository';
import { Job, JobStatus } from '../entities/job';
import { ILogger } from '../services/logger';
import c, { IConfig } from 'config';
import { DBError, InvalidJobError, JobExistsAlreadyError, JobNotFoundError } from '../errors/errors';
import { IQueueConnector, SQSConnector } from '../services/queue';
import { JobQueueMessage } from '../entities/queueMessage';

const objectId = mongodb.ObjectId;

export class JobRepository extends BaseRepository {
  private _queueConnector: IQueueConnector;
  constructor(db: mongodb.Db, config: IConfig, logger: ILogger, collectionName: string | null = null) {
    let collection = db.collection(config.get('jobQueueCollection'));
    if (collectionName) {
      collection = db.collection(collectionName);
    }
    super(config, logger, 'JobRepository', collection);
    this._queueConnector = new SQSConnector(logger, config);
  }

  async updateWithCompletionStatus(id: string, result: any): Promise<boolean> {
    const query = { _id: id };
    const update = {
      $set: {
        status: 'completed',
        endTime: new Date(),
        result,
      },
    };
    const bRet = await this.updateOne(
      query,
      update,
      `Mongo Timeout Error: Timed out while updating success status for jobId: ${id}`
    );
    if (bRet) {
      await this._queueConnector.sendMessage(
        new JobQueueMessage(id, JobStatus.completed),
        this._config.get('jobUpdatesQueueUrl'),
        0
      );
    }
    return bRet;
  }

  async insertJob(job: any, url: string): Promise<string> {
    const filterDoc = { payload: job.payload, status: { $in: ['inQueue', 'inProgress'] } };
    const updateDoc = {
      $setOnInsert: job,
    };
    const jobId = await this.upsert(filterDoc, updateDoc, `Mongo Timeout Error: Timed out while inserting Job`);
    if (!jobId) {
      throw new JobExistsAlreadyError('InsertJobFailed: Job exists Already');
    }
    // Insertion/re-enqueueing should be sent to jobs queue and updates for an existing job should be sent to jobUpdates Queue

    await this._queueConnector.sendMessage(new JobQueueMessage(jobId, JobStatus.inQueue), url, 0);
    return jobId;
  }

  async insertJBulkJobs(jobs: Array<any>, url: string): Promise<Array<any>> {
    const jobIds = await this.insertMany(jobs, `Mongo Timeout Error: Timed out while inserting bulk Jobs`);
    if (!jobIds) {
      throw new DBError('insertJBulkJobs: Unable to insert multiple jobs');
    }
    // Insertion/re-enqueueing should be sent to jobs queue and updates for an existing job should be sent to jobUpdates Queue
    this._logger.info('insertJBulkJobs', `Total Jobs Expected : ${jobs.length}, Total Jobs Sent: ${jobIds.length}`);
    await Promise.all(
      Object.values(jobIds).map(async (jobId: string) => {
        await this._queueConnector.sendMessage(new JobQueueMessage(jobId, JobStatus.inQueue), url, 0);
        this._logger.info('insertJBulkJobs', `inserted ${jobId}`);
      })
    );
    return jobIds;
  }

  async getJobById(id: string): Promise<Job | null> {
    const query = {
      _id: new objectId(id),
    };
    const resp = await this.findOne(query, `Mongo Timeout Error: Timed out while find job by id Job`);
    if (!resp) {
      throw new JobNotFoundError('GetJobByID Failed');
    }
    return Object.assign(new Job(), resp);
  }

  async getJobByIdAndUpdate(id: string): Promise<Job | null> {
    const query = {
      _id: new objectId(id),
    };
    return await this.findOneAndUpdateJob(query);
  }

  async notify(jobId: string, url: string, status: JobStatus, delay: number) {
    await this._queueConnector.sendMessage(new JobQueueMessage(jobId, status), url, delay);
  }

  async findOneAndUpdateJob(query): Promise<Job | null> {
    const update = { $set: { startTime: new Date(), status: 'inProgress' } };
    const options = { sort: { priority: -1, createdTime: 1 }, returnNewDocument: true };
    const response = await this.findOneAndUpdate(
      query,
      update,
      options,
      `Mongo Timeout Error: Timed out while retrieving job`
    );
    if (!response) {
      throw new InvalidJobError('JobRepository:getOneQueuedJobAndUpdate retrieved Undefined job');
    }
    if (response.value) {
      const job = Object.assign(new Job(), response.value);
      await this.notify(job._id, c.get('jobUpdatesQueueUrl'), JobStatus.inProgress, 0);
      return job;
    }
    return null;
  }

  async getOneQueuedJobAndUpdate(): Promise<Job | null> {
    const query = {
      status: 'inQueue',
      createdTime: { $lte: new Date() },
    };
    return await this.findOneAndUpdateJob(query);
  }
  async updateWithErrorStatus(id: string, reason: string): Promise<boolean> {
    const query = { _id: id };
    const update = {
      $set: { status: 'failed', endTime: new Date(), error: { time: new Date().toString(), reason: reason } },
    };
    const bRet = await this.updateOne(
      query,
      update,
      `Mongo Timeout Error: Timed out while updating failure status for jobId: ${id}`
    );
    if (bRet) {
      await this.notify(id, c.get('jobUpdatesQueueUrl'), JobStatus.inProgress, 0);
    }
    return bRet;
  }

  async insertLogStatement(id: string, messages: Array<string>): Promise<boolean> {
    const query = { _id: id };
    const update = {
      $push: { ['logs']: { $each: messages } },
    };
    return await this.updateOne(
      query,
      update,
      `Mongo Timeout Error: Timed out while inserting log statements for jobId: ${id}`
    );
  }

  async insertNotificationMessages(id: string, message: string): Promise<boolean> {
    const query = { _id: id };
    const update = {
      $push: { comMessage: message },
    };
    return await this.updateOne(
      query,
      update,
      `Mongo Timeout Error: Timed out while inserting notification messages for jobId: ${id}`
    );
  }

  async insertPurgedUrls(id: string, urlArray: Array<string>): Promise<boolean> {
    const query = { _id: id };
    const update = {
      $push: { ['purgedURLs']: urlArray },
    };
    return await this.updateOne(
      query,
      update,
      `Mongo Timeout Error: Timed out while inserting purged urls for jobId: ${id}`
    );
  }

  async insertInvalidationRequestStatusUrl(id: string, url: string): Promise<boolean> {
    const query = { _id: id };
    const update = {
      $set: { invalidationStatusURL: url },
    };
    return await this.updateOne(
      query,
      update,
      `Mongo Timeout Error: Timed out while inserting purged urls for jobId: ${id}`
    );
  }

  async resetJobStatus(id: string, status: string, reenqueueMessage: string) {
    const query = { _id: id };
    const update = {
      $set: {
        status: status,
        startTime: null,
        error: {},
        logs: [reenqueueMessage],
      },
    };
    const bRet = await this.updateOne(
      query,
      update,
      `Mongo Timeout Error: Timed out finishing re-enqueueing job for jobId: ${id}`
    );

    if (bRet) {
      // Insertion/re-enqueueing should be sent to jobs queue and updates for an existing job should be sent to jobUpdates Queue
      await this.notify(id, c.get('jobsQueueUrl'), JobStatus.inProgress, 0);
    }
    return bRet;
  }
}
