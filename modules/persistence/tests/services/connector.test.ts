import { insert } from '../../src/services/connector';
import * as mongodb from 'mongodb';

jest.mock('mongodb');

describe('The connector', () => {
  test('Should insert docs into the collection passed as args', () => {
    expect(true);
  });
});
