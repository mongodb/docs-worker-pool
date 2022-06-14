import { BatchClient, SubmitJobCommand } from '@aws-sdk/client-batch';

export class Batch {
    private client: BatchClient;
    private readonly environment: string;

    constructor() {
        this.client = new BatchClient({});
        this.environment = 'dev';
    }
    async submitArchiveJob(sourceBucket: string, targetBucket: string, siteName: string) {
        const command = new SubmitJobCommand({
            jobName: 'archive',
            jobQueue: `docs-archive-${this.environment}`,
            jobDefinition: `docs-archive-${this.environment}`,
            parameters: {
                'source-bucket': sourceBucket,
                'target-bucket': targetBucket,
                'site-name': siteName
            }
        });
        const response = await this.client.send(command);
        console.log(response);
    }
}