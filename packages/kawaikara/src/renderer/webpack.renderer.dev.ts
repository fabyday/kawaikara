import { merge } from 'webpack-merge';
import baseConfig from './webpack.renderer.base';

export default merge(baseConfig, {
    mode: 'development',
    devtool: 'source-map',
    optimization: {
        minimize: false,
        usedExports: false,
    },
});
