import { IQueue, Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export class AutoBuilderQueuesConstruct extends Construct {
  jobsQueue: IQueue;
  jobUpdatesQueue: IQueue;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const config = { fifo: true };

    const jobsQueue = new Queue(this, 'JobsQueue', config);
    const jobUpdatesQueue = new Queue(this, 'JobUpdatesQueue', config);

    this.jobsQueue = jobsQueue;
    this.jobUpdatesQueue = jobUpdatesQueue;
  }
}
