import { merge } from 'webpack-merge';
import baseConfig from './webpack.preload.base';

export default merge(baseConfig, {
    mode: 'development',
    devtool: 'source-map',
    optimization: {
        minimize: false,
        usedExports: false,
    },
});
