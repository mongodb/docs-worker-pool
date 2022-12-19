import { ModuleOptions } from '../types';

export interface OASPageMetadata {
  source_type: string;
  source: string;
}

export type OASPagesMetadata = Record<string, OASPageMetadata>;

export interface BuildMetadata {
  siteTitle: string;
  openapiPages: OASPagesMetadata;
}

export interface PageBuilderOptions extends Omit<ModuleOptions, 'bundle'> {
  siteTitle: string;
}
