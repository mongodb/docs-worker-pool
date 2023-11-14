import { IVpc } from 'aws-cdk-lib/aws-ec2';
import {
  AssetImageProps,
  Cluster,
  ContainerDependencyCondition,
  ContainerImage,
  FargateService,
  FargateTaskDefinition,
  LogDrivers,
  Protocol,
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
      actions: ['ssm:GetParameter'],
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
      file: isEnhanced() ? 'Dockerfile.enhanced' : undefined,
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

    const xrayTracingPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'xray:PutTraceSegments',
        'xray:PutTelemetryRecords',
        'xray:GetSamplingRules',
        'xray:GetSamplingTargets',
        'xray:GetSamplingStatisticSummaries',
      ],
      resources: ['*'],
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

    taskRole.addToPolicy(xrayTracingPolicy);
    taskRole.addToPolicy(updateTaskProtectionPolicy);

    const sideCar = taskDefinition.addContainer('xraySidecar', {
      image: ContainerImage.fromRegistry('amazon/aws-xray-daemon'),
      logging: LogDrivers.awsLogs({
        streamPrefix: 'xraysidecarvroom',
      }),
      portMappings: [
        {
          protocol: Protocol.UDP,
          containerPort: 2000,
        },
      ],
    });
    const workerTaskDefContainer = taskDefinition.addContainer('workerImage', {
      image: ContainerImage.fromAsset(path.join(__dirname, '../../../../'), containerProps),
      environment: { ...dockerEnvironment, AWS_XRAY_DAEMON_ADDRESS: 'xraySidecar:2000' },
      logging: LogDrivers.awsLogs({
        streamPrefix: 'autobuilderworker',
        logGroup: taskDefLogGroup,
      }),
    });

    workerTaskDefContainer.addContainerDependencies({
      container: sideCar,
      condition: ContainerDependencyCondition.START,
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
