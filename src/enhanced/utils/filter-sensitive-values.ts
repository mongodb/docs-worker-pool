import { sensitiveKeys } from './get-sensitive-values';

export const filterSensitiveValues = (message: string) => {
  for (const key of sensitiveKeys) {
    if (message.includes(key)) {
      message = message.replace(key, '*******');
    }
  }

  return message;
};
