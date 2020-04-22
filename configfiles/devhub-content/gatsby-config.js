const { siteMetadata } = require('./src/utils/site-metadata');

module.exports = {
  pathPrefix: 'devhub',
  plugins: ['gatsby-plugin-react-helmet', `gatsby-plugin-emotion`],
  siteMetadata: {
        ...siteMetadata,
        title: 'MongoDB Developer Hub',
    },
};
