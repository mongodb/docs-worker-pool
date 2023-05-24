import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, ContainerImage, FargateTaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';
import path from 'path';

export class WorkerConstruct extends Construct {
  readonly taskDefinitionArn: string;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const vpc = new Vpc(this, 'vpc');

    new Cluster(this, 'cluster', { vpc, enableFargateCapacityProviders: true });

    const taskDef = new FargateTaskDefinition(this, 'workerTaskDef', {
      cpu: 2048,
      memoryLimitMiB: 8192,
    });

    taskDef.addContainer('workerContainer', {
      image: ContainerImage.fromAsset(path.join(__dirname, '../../../../')), // path to the directory of the Dockerfile
    });

    this.taskDefinitionArn = taskDef.taskDefinitionArn;
  }
}
