import { IVpc } from 'aws-cdk-lib/aws-ec2';
import {
  AssetImageProps,
  Cluster,
  ContainerImage,
  FargateService,
  FargateTaskDefinition,
  LogDrivers,
} from 'aws-cdk-lib/aws-ecs';
import { Effect, IRole, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import path from 'path';
import { getEnv, isEnhanced } from '../../../utils/env';

interface WorkerConstructProps {
  dockerEnvironment: Record<string, string>;
  jobsQueue: IQueue;
  jobUpdatesQueue: IQueue;
  vpc: IVpc;
}
export class WorkerConstruct extends Construct {
  readonly ecsTaskRole: IRole;
  readonly clusterName: string;

  constructor(
    scope: Construct,
    id: string,
    { dockerEnvironment, jobsQueue, jobUpdatesQueue, vpc }: WorkerConstructProps
  ) {
    super(scope, id);

    const cluster = new Cluster(this, 'cluster', {
      vpc,
      enableFargateCapacityProviders: true,
      containerInsights: true,
    });

    const taskRoleSsmPolicyStatement = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['ssm:GetParameter', 'ssm:PutParameter'],
      resources: ['*'],
    });

    const taskRole = new Role(this, 'fargateTaskRole', {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    taskRole.addToPolicy(taskRoleSsmPolicyStatement);

    jobsQueue.grantConsumeMessages(taskRole);
    jobUpdatesQueue.grantSendMessages(taskRole);

    const executionRoleSsmPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['ssm:GetParameters'],
      resources: ['*'],
    });

    const executionRole = new Role(this, 'fargateExecutionRole', {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    executionRole.addToPolicy(executionRoleSsmPolicy);

    const containerProps: AssetImageProps = {
      buildArgs: {
        NPM_BASE_64_AUTH: dockerEnvironment.NPM_BASE_64_AUTH,
        NPM_EMAIL: dockerEnvironment.NPM_EMAIL,
      },
    };

    const taskDefLogGroup = new LogGroup(this, 'workerLogGroup');
    const taskDefinition = new FargateTaskDefinition(this, 'workerTaskDefinition', {
      cpu: 4096,
      memoryLimitMiB: 8192,
      taskRole,
      executionRole,
    });

    const updateTaskProtectionPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['ecs:UpdateTaskProtection'],
      conditions: {
        ArnEquals: {
          'ecs:cluster': cluster.clusterArn,
        },
      },
      resources: ['*'],
    });

    taskRole.addToPolicy(updateTaskProtectionPolicy);

    taskDefinition.addContainer('workerImage', {
      image: ContainerImage.fromAsset(path.join(__dirname, '../../../../'), containerProps),
      environment: dockerEnvironment,
      command: ['node', '--enable-source-maps', 'enhanced/enhancedApp.js'],
      logging: LogDrivers.awsLogs({
        streamPrefix: 'autobuilderworker',
        logGroup: taskDefLogGroup,
      }),
    });

    const env = getEnv();

    new FargateService(this, 'fargateService', {
      cluster,
      taskDefinition,
      desiredCount: env === 'prd' ? 10 : 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    this.clusterName = cluster.clusterName;
    this.ecsTaskRole = taskRole;
  }
}
