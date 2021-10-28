import mongodb from "mongodb";
import { BaseRepository } from "./baseRepository";
import { Job } from "../entities/job"
import { ILogger } from "../services/logger";
import { IConfig } from 'config';
import { InvalidJobError, JobExistsAlreadyError } from "../errors/errors";

export class JobRepository extends BaseRepository {
    constructor(db: mongodb.Db, config: IConfig, logger: ILogger) {
        super(config, logger, "JobRepository", db.collection(config.get("jobQueueCollection")));
    }

    async updateWithCompletionStatus(id: string, result: any): Promise<boolean> {
        const query = { _id: id };
        const update = {
            $set: {
                status: "completed",
                endTime: new Date(),
                result
            },
        };
        return await this.updateOne(query, update, `Mongo Timeout Error: Timed out while updating success status for jobId: ${id}`);
    }

    async insertJob(job: any): Promise<void> {
        const filterDoc = { payload: job.payload, status: { $in: ["inQueue", "inProgress"] } };
        const updateDoc = {
            $setOnInsert: job
        };
        if (!await this.upsert(filterDoc, updateDoc, `Mongo Timeout Error: Timed out while inserting Job`)) {
            throw new JobExistsAlreadyError("InsertJobFailed");
        }
    }

    async getOneQueuedJobAndUpdate(): Promise<Job | null> {
        const query = {
            status: 'inQueue',
            createdTime: { $lte: new Date() },
        };
        const update = { $set: { startTime: new Date(), status: 'inProgress' } };
        const options = { sort: { priority: -1, createdTime: 1 }, returnNewDocument: true };
        let response = await this.findOneAndUpdate(query, update, options, `Mongo Timeout Error: Timed out while retrieving job`);
        if (!response) {
            throw new InvalidJobError("JobRepository:getOneQueuedJobAndUpdate retrieved Undefined job");
        }
        if (response.value) {
            return Object.assign(new Job(), response.value)
        }
        return null;
    }
    async updateWithErrorStatus(id: string, reason: string): Promise<boolean> {
        const query = { _id: id };
        const update = {
            $set: { status: 'failed', endTime: new Date(), error: { time: new Date().toString(), reason: reason } }
        };
        return await this.updateOne(query, update, `Mongo Timeout Error: Timed out while updating failure status for jobId: ${id}`);
    }

    async insertLogStatement(id: string, messages: Array<string>): Promise<boolean> {
        const query = { _id: id };
        const update = {
            $push: { ['logs']: { $each: messages } }
        };
        return await this.updateOne(query, update, `Mongo Timeout Error: Timed out while inserting log statements for jobId: ${id}`);
    }

    async insertNotificationMessages(id: string, message: string): Promise<boolean> {
        const query = { _id: id };
        const update = {
            $push: { comMessage: message }
        };
        return await this.updateOne(query, update, `Mongo Timeout Error: Timed out while inserting notification messages for jobId: ${id}`);
    }

    async insertPurgedUrls(id: string, urlArray: Array<string>): Promise<boolean> {
        const query = { _id: id };
        const update = {
            $push: { ['purgedURLs']: urlArray }
        };
        return await this.updateOne(query, update, `Mongo Timeout Error: Timed out while inserting purged urls for jobId: ${id}`);
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
        return await this.updateOne(query, update, `Mongo Timeout Error: Timed out finishing re-enqueueing job for jobId: ${id}`);
    }

}