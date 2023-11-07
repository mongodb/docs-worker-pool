import { NodeSDK } from '@opentelemetry/sdk-node';
import { AWSXRayPropagator } from '@opentelemetry/propagator-aws-xray';

import { detectResourcesSync } from '@opentelemetry/resources';
import { awsEcsDetector } from '@opentelemetry/resource-detector-aws';

import { ConsoleSpanExporter, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { AWSXRayIdGenerator } from '@opentelemetry/id-generator-aws-xray';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';

export function nodeSDKBuilder() {
  const resource = detectResourcesSync({
    detectors: [awsEcsDetector],
  });

  console.log('RESOURCES: ', resource.attributes);

  const sdk = new NodeSDK({
    textMapPropagator: new AWSXRayPropagator(),
    idGenerator: new AWSXRayIdGenerator(),
    resource,
    traceExporter: new ConsoleSpanExporter(),
  });

  console.log('Starting OpenTelemetry server');
  sdk.start();

  const provider = new WebTracerProvider({ resource });

  const exporter = new ConsoleSpanExporter();
  const spanProcessor = new BatchSpanProcessor(exporter);

  provider.addSpanProcessor(spanProcessor);
  provider.register();

  process.on('SIGTERM', async () => {
    await sdk.shutdown();
    console.log('Tracing and Metrics terminated');
  });
}

nodeSDKBuilder();
