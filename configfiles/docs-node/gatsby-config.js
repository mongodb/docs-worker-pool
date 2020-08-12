const { siteMetadata } = require('./src/utils/site-metadata');

module.exports = {
  pathPrefix: 'drivers/node',
  plugins: ['gatsby-plugin-react-helmet', `gatsby-plugin-emotion`],
  siteMetadata,
};
