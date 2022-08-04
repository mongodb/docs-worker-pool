import axios from 'axios';

export const ecsMetadata = async () => {
  const { ECS_CONTAINER_METADATA_URI_V4 } = process.env;
  return ECS_CONTAINER_METADATA_URI_V4 ? axios.get(ECS_CONTAINER_METADATA_URI_V4) : null;
};
