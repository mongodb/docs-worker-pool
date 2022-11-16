export interface OASPageMetadata {
  source_type: string;
  source: string;
}

export type OASPagesMetadata = Record<string, OASPageMetadata>;
