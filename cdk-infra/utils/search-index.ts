import { AutoBuilderEnv } from './env';

export function getSearchIndexFolder(env: AutoBuilderEnv): string {
  switch (env) {
    case 'dev':
      return '';
    case 'stg':
    case 'dotcomstg':
    case 'legacydotcomstg':
      return 'preprd';
    case 'dotcomprd':
    case 'legacydotcomprd':
    case 'prd':
      return 'prd';
  }
}
