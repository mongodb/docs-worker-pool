const { generatePathPrefix } = require('./src/utils/generate-path-prefix');
const { getMetadata } = require('./src/utils/get-metadata');

const runningEnv = process.env.NODE_ENV || 'production';
å
require('dotenv').config({
    path: `.env.${runningEnv}`,
});

const metadata = getMetadata();

module.exports = {
    pathPrefix: 'devhub',
    plugins: ['gatsby-plugin-react-helmet', 'gatsby-plugin-emotion'],
    siteMetadata: {
        ...metadata,
        title: 'MongoDB Developer Hub',
    },
};

