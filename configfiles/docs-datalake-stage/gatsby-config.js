const { siteMetadata } = require('./src/utils/site-metadata');

module.exports = {
  pathPrefix: 'datalake-stage',
  plugins: ['gatsby-plugin-react-helmet', `gatsby-plugin-emotion`],
  siteMetadata,
};
