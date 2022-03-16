import { OktaConnector } from '../../../src/services/sso';
import { ParameterStoreConnector } from '../../../src/services/ssm';
import { ConsoleLogger } from '../../../src/services/logger';
import * as c from 'config';

export const RefreshInvalidatorOAuthToken = async (event: any = {}): Promise<any> => {
  const consoleLogger = new ConsoleLogger();
  const ssoConnector = new OktaConnector(c, consoleLogger);
  const res = await ssoConnector.retrieveOAuthToken();
  if (res && res.data && 'access_token' in res.data) {
    const ssmConnector = new ParameterStoreConnector();
    await ssmConnector.putParameter(
      `/env/${c.get<string>('env')}/${c.get<string>('oauthTokenPath')}`,
      res.data['access_token'],
      true,
      'OAuth Token',
      'SecureString',
      true
    );
  } else {
    consoleLogger.error('RefreshInvalidatorOAuthToken', 'FAILED in refreshing token');
  }
};
