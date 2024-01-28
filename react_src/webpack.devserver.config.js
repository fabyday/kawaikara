const {merge} = require("webpack-merge")
const baseConfig = require('./webpack.config.js');

module.exports = (env, options) => {
    const webpackConfig = baseConfig(env, options);

    return merge(webpackConfig, {
        output: {
            path: __dirname + '/build/',
            publicPath: 'http://localhost:4000/build/',
            filename: 'bundle.js'
        },
        optimization: {
            nodeEnv: 'web'
        },
        node: false,
        target: 'web',
        devServer: {
            publicPath: '/build/',
            port: 4000
        }    
    });
};