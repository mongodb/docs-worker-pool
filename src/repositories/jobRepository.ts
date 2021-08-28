import { Db } from 'mongodb';
import { BaseRepository } from "./BaseRepository";
import { Job } from "../entities/job"
import { ILogger } from "../services/logger";

export class JobRepository extends BaseRepository<Job> {

    constructor(db: Db, collectionName: string, logger: ILogger) {
        super(db, collectionName, logger);
        this._repoName = "JobRepository";
    }

    async updateWithCompletionStatus(id: string, result: any): Promise<boolean> {
        const query = { _id: id };
        const update = {
            $set: {
                status: "completed",
                result,
                endTime: new Date(),
            },
        };
        return await this.updateOne(query, update);
    }

    async getOneQueuedJobAndUpdate(): Promise<Job> {
        const query = {
            status: 'inQueue',
            createdTime: { $lte: new Date() },
        };

        const update = { $set: { startTime: new Date(), status: 'inProgress' } };
        const options = { sort: { priority: -1, createdTime: 1 }, returnNewDocument: true };
        let response = await this.findOneAndUpdate(query, update, options);
        return Object.assign(new Job(), response)

    }
    async updateWithErrorStatus(id: string, reason: string): Promise<boolean> {
        const query = { _id: id };
        const update = {
            $set: { startTime: null, status: 'failed', error: { time: new Date().toString(), reason: reason } }
        };
        return await this.updateOne(query, update);
    }

    async insertLogStatement(id: string, messages: Array<string>): Promise<boolean> {
        const query = { _id: id };
        const update = {
            $push: { ['logs']: { $each: messages } }
        };
        return await this.updateOne(query, update);
    }

    async insertNotificationMessages(id:string, message: string): Promise<boolean> {
        const query = { _id: id };
        const update = {
            $push: { comMessage: message }
        };
        return await this.updateOne(query, update);
    }

    async insertPurgedUrls(id:string, urlArray: Array<string>): Promise<boolean> {
        const query = { _id: id };
        const update = {
            $push: { ['purgedURLs']: urlArray }
        };
        return await this.updateOne(query, update);
    }

    async resetJobStatus(id:string, reenqueueMessage: string) {
        const query = { _id: id };
        const update = {
            $set: {
                status: "inQueue",
                startTime: null,
                error: {},
                logs: [reenqueueMessage],
            },
        };
        return await this.updateOne(query, update);
    }

}