import * as mongodb from 'mongodb';
import { BaseRepository } from './baseRepository';
import type { Job } from '../entities/job';
import { JobStatus } from '../entities/job';
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
      await this.notify(id, c.get('jobUpdatesQueueUrl'), JobStatus.completed, 0);
    }
    return bRet;
  }

  async insertJob(job: Omit<Job, '_id'>, url: string): Promise<string> {
    const filterDoc = { payload: job.payload, status: { $in: ['inQueue', 'inProgress'] } };
    const updateDoc = {
      $setOnInsert: job,
    };
    const jobId = await this.upsert(filterDoc, updateDoc, `Mongo Timeout Error: Timed out while inserting Job`);
    if (!jobId) {
      throw new JobExistsAlreadyError('InsertJobFailed: Job exists Already');
    }
    // Insertion/re-enqueueing should be sent to jobs queue and updates for an existing job should be sent to jobUpdates Queue
    await this.notify(jobId, url, JobStatus.inQueue, 0);
    return jobId;
  }

  async insertBulkJobs(jobs: Array<any>, url: string): Promise<Array<any>> {
    const jobIds = await this.insertMany(jobs, `Mongo Timeout Error: Timed out while inserting bulk Jobs`);
    if (!jobIds) {
      throw new DBError('insertBulkJobs: Unable to insert multiple jobs');
    }
    // Insertion/re-enqueueing should be sent to jobs queue and updates for an existing job should be sent to jobUpdates Queue
    this._logger.info('insertBulkJobs', `Total Jobs Expected : ${jobs.length}, Total Jobs Sent: ${jobIds.length}`);
    await Promise.all(
      Object.values(jobIds).map(async (jobId: string) => {
        await this._queueConnector.sendMessage(new JobQueueMessage(jobId, JobStatus.inQueue), url, 0);
        this._logger.info('insertBulkJobs', `inserted ${jobId}`);
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
    return Object.assign({}, resp);
  }

  async getJobByIdAndUpdate(id: string): Promise<Job | null> {
    const query = {
      _id: new objectId(id),
    };
    return await this.findOneAndUpdateJob(query);
  }

  async notify(jobId: string, url: string, status: JobStatus, delay: number, taskId?: string) {
    await this._queueConnector.sendMessage(new JobQueueMessage(jobId, status, 0, taskId), url, delay);
  }

  async findOneAndUpdateExecutionTime<Query, UpdateValues, Options>(
    query: Query,
    update: UpdateValues,
    options: Options,
    errorMsg: string
  ): Promise<void> {
    this.findOneAndUpdate(query, update, options, errorMsg);
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
    } else if (response.value) {
      const job: Job = response.value;
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

  async failStuckJobs(hours: number) {
    const hourInMS = 1000 * 60 * 60;
    const currentTime = new Date();
    const failReason = `Job timeout error: Job has been running for at least ${hours} hours`;

    const query = {
      status: JobStatus.inProgress,
      startTime: {
        $lte: new Date(currentTime.getTime() - hourInMS * hours),
      },
    };
    const findOptions = {
      projection: {
        _id: 1,
        taskId: 1,
      },
    };
    const update = {
      $set: {
        status: JobStatus.timedOut,
        endTime: currentTime,
        error: { time: currentTime.toString(), reason: failReason },
      },
    };

    // Mongo's updateMany does not return the IDs of documents changed, so we find them first
    const stuckJobsCursor = await this.find(query, `Mongo Timeout Error: Timed out finding stuck jobs.`, findOptions);
    const stuckJobs = await stuckJobsCursor.toArray();
    this._logger.info('failStuckJobs', `Found ${stuckJobs.length} jobs.`);
    // No stuck jobs found
    if (!stuckJobs.length) return;

    // Since the same query is split into 2 operations, there's a very small chance
    // that there might be a mismatch between jobs updated in the db vs. in the queue.
    const bRet = await this.updateMany(query, update, `Mongo Timeout Error: Timed out updating stuck jobs.`);
    if (!bRet) {
      throw new DBError('failStuckJobs: Unable to update stuck jobs.');
    }

    const jobUpdatesQueueUrl: string = this._config.get('jobUpdatesQueueUrl');
    await Promise.all(
      stuckJobs.map((stuckJob: any) => {
        const id: string = stuckJob._id.toString();
        return this.notify(id, jobUpdatesQueueUrl, JobStatus.timedOut, 0, stuckJob.taskId);
      })
    );
  }

  async addTaskIdToJob(id: string, taskId: string): Promise<void> {
    const query = { _id: new objectId(id) };
    const update = {
      $set: {
        taskId: taskId,
      },
    };

    await this.updateOne(query, update, `Mongo Timeout Error: Timed out while updating taskId for jobId: ${id}`);
  }
}
