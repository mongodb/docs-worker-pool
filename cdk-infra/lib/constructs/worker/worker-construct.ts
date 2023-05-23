import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, FargateTaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';

export class WorkerConstruct extends Construct {
  readonly taskDefinitionArn: string;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const vpc = new Vpc(this, 'vpc');

    new Cluster(this, 'cluster', { vpc, enableFargateCapacityProviders: true });

    const taskDef = new FargateTaskDefinition(this, 'fargateTaskDef');

    this.taskDefinitionArn = taskDef.taskDefinitionArn;
  }
}
