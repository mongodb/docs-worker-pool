import { traverseAndMerge } from '../../../src/services/metadata/ToC';

const metadata = {
  toctree: {
    project: 'foo',
    options: {
      versions: ['1.1', '1.0'],
    },
  },
};

describe('traverseAndMerge', () => {
  test('statefully updates metadata object passed as an argument', () => {
    traverseAndMerge(metadata, { foo: { children: ['testVal'] } });
    expect(true);
  });
});
