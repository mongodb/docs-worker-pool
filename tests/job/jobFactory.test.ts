import {JobFactory} from '../../job/jobFactory';

test('Construct Job Factory', () => {
    expect(new JobFactory()).toBeDefined();
  })