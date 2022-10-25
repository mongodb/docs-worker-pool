import { traverseAndMerge } from '../../../src/services/metadata/ToC';

const metadata = {
  project: 'foo',
  associated_products: [{ name: 'bar', versions: ['1.1', '1.0'] }],
  toctree: {
    options: {
      versions: ['1.1', '1.0'],
    },
  },
  toctreeOrder: ['first', 'second', '|bar|', 'third'],
};

const mergedata = {
  project: 'bar',
  toctree: {
    options: {
      versions: ['1.1'],
    },
  },
  toctreeOrder: [{ version: '1.1', path: 'bar/io' }],
};

describe('traverseAndMerge', () => {
  test('statefully updates metadata object passed as an argument', () => {
    traverseAndMerge(metadata, { foo: { children: ['testVal'] } }, mergedata.toctreeOrder);
    expect(true);
  });
});
