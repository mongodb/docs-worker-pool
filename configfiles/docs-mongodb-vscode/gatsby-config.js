const { siteMetadata } = require('./src/utils/site-metadata');

module.exports = {
  pathPrefix: 'mongodb-vscode',
  plugins: ['gatsby-plugin-react-helmet', `gatsby-plugin-emotion`],
  siteMetadata,
};
