const { getMetadata } = require('./src/utils/get-metadata');
const { siteMetadata } = require('./src/utils/site-metadata');

const metadata = getMetadata();

module.exports = {
  pathPrefix: 'devhub',
  plugins: ['gatsby-plugin-react-helmet', `gatsby-plugin-emotion`],
  siteMetadata: {
        ...metadata,
        title: 'MongoDB Developer Hub',
    },
};
