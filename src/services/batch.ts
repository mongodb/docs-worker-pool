import { BatchClient, SubmitJobCommand, SubmitJobCommandOutput } from '@aws-sdk/client-batch';

export class Batch {
    private readonly environment: string;
    private readonly client: BatchClient;

    constructor(environment: string = 'dev') {
        this.client = new BatchClient({});
        this.environment = environment;
    }

    async submitArchiveJob(sourceBucket: string, targetBucket: string, siteName: string): Promise<SubmitJobCommandOutput> {
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
        return await this.client.send(command);
    }
}
