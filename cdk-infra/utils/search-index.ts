import { AutoBuilderEnv } from './env';

export function getSearchIndexFolder(env: AutoBuilderEnv): string {
  switch (env) {
    case 'dev':
      return '';
    case 'stg':
    case 'dotcomstg':
      return 'preprd';
    case 'dotcomprd':
    case 'prd':
      return 'prd';
  }
}
