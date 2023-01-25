import { convertSlugToUrl } from '../../../src/services/metadata/ToC/utils/convertSlugToUrl';

describe('convertSlugToUrl', () => {
  it("accepts a project's prefix, slug, and base url, and returns an absolute url for href usage", () => {
    expect(convertSlugToUrl('get-started', 'docs/atlas/cli', 'www.mongodb.com')).toEqual(
      'www.mongodb.com/docs/atlas/cli/get-started'
    );
  });
});
