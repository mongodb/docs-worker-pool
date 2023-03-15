import { ModuleOptions } from '../types';

export interface OASPageMetadata {
  source_type: string;
  source: string;
  api_version?: string;
  resource_versions?: string[];
}

export type OASPagesMetadata = Record<string, OASPageMetadata>;

export interface BuildMetadata {
  siteTitle: string;
  openapiPages: OASPagesMetadata;
}

export interface PageBuilderOptions extends Omit<ModuleOptions, 'bundle'> {
  siteTitle: string;
}

export interface RedocBuildOptions {
  ignoreIncompatibleTypes?: boolean;
  apiVersion?: string;
  resourceVersion?: string;
}

export interface RedocVersionOptions {
  active: {
    apiVersion: string;
    resourceVersion: string;
  };
  rootUrl: string;
  resourceVersions: string[];
}
