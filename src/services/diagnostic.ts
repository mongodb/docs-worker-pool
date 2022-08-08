import axios from 'axios';

export interface EcsMetadata {
  DockerId: string;
  [key: string]: any;
}

const memoizedMetadata: EcsMetadata = { DockerId: '' };

export const ecsMetadata = async (): Promise<EcsMetadata> => {
  const { ECS_CONTAINER_METADATA_URI_V4 } = process.env;
  if (ECS_CONTAINER_METADATA_URI_V4 && !memoizedMetadata.DockerId) {
    const { data = {} } = await axios.get(ECS_CONTAINER_METADATA_URI_V4);
    memoizedMetadata.DockerId = data.DockerId || '';
  }
  return memoizedMetadata;
};
