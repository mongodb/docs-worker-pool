const { siteMetadata } = require('./src/utils/site-metadata');

module.exports = {
  pathPrefix: 'mongodb-shell',
  plugins: ['gatsby-plugin-react-helmet', `gatsby-plugin-emotion`],
  siteMetadata,
};
