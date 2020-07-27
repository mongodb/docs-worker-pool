const { siteMetadata } = require('./src/utils/site-metadata');

module.exports = {
  pathPrefix: 'node',
  plugins: ['gatsby-plugin-react-helmet', `gatsby-plugin-emotion`],
  siteMetadata,
};
