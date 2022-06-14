import { BatchClient, SubmitJobCommand } from '@aws-sdk/client-batch';

export class Batch {
    private client: BatchClient;
    constructor() {
        this.client = new BatchClient();
    }
}