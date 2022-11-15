export interface OASPageMetadata {
  source_type: string;
  source: string;
}

export type OASPagesMetadata = Record<string, OASPageMetadata>;
export type OASPageMapping = Record<string, string>;
