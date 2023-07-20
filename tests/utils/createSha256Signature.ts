import crypto from 'crypto';

/**
 * Mocks the creation of a SHA-256 signature
 * @param payloadString
 * @param secret
 */
export const createSha256Signature = (payloadString: string, secret: string, prefix = '') => {
  const sig = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
  return prefix + sig;
};
