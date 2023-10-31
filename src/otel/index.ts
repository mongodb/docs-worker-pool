import { NodeSDK } from '@opentelemetry/sdk-node';
import { AWSXRayPropagator } from '@opentelemetry/propagator-aws-xray';

import { detectResourcesSync } from '@opentelemetry/resources';
import { awsEcsDetector } from '@opentelemetry/resource-detector-aws';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import { AWSXRayIdGenerator } from '@opentelemetry/id-generator-aws-xray';

export function nodeSDKBuilder() {
  const resource = detectResourcesSync({
    detectors: [awsEcsDetector],
  });

  const traceExporter = new OTLPTraceExporter();
  const spanProcessor = new SimpleSpanProcessor(traceExporter);

  const sdk = new NodeSDK({
    textMapPropagator: new AWSXRayPropagator(),
    instrumentations: [
      new HttpInstrumentation(),
      new AwsInstrumentation({
        sqsExtractContextPropagationFromPayload: true,
      }),
    ],
    idGenerator: new AWSXRayIdGenerator(),
    resource,
    traceExporter,
    spanProcessor,
  });

  console.log('Starting OpenTelemetry server');
  sdk.start();

  process.on('SIGTERM', async () => {
    await sdk.shutdown();
    console.log('Tracing and Metrics terminated');
  });
}

nodeSDKBuilder();
