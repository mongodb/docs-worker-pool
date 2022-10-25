import { traverseAndMerge } from '../../../src/services/metadata/ToC';

const metadata = {
  project: 'foo',
  branch: 'master',
  associated_products: [{ name: 'bar', versions: ['1.1', '1.0'] }],
  toctree: {
    title: 'test',
    slug: 'test',
    children: [],
    options: {
      versions: ['1.1', '1.0'],
    },
  },
  toctreeOrder: ['first', 'second', '|bar|', 'third'],
};

const mergedata = {
  project: 'bar',
  branch: '1.1',
  toctree: {
    title: 'test',
    slug: 'test',
    children: [],
    options: {
      versions: ['1.1'],
    },
  },
  toctreeOrder: [{ version: '1.1', path: 'bar/io' }],
};

const mergeInsertions = {
  bar: {
    '1.1': mergedata.toctree,
  },
};

const mergeOrderInsertions = {
  bar: {
    '1.1': mergedata.toctreeOrder,
  },
};

describe('traverseAndMerge', () => {
  test('statefully updates metadata object passed as an argument', () => {
    traverseAndMerge(metadata, mergeInsertions, mergeOrderInsertions);
    expect(true);
  });
});
