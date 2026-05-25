import { merge } from 'webpack-merge';
import baseConfig from './webpack.renderer.base';

export default merge(baseConfig, {
    mode: 'production',
    devtool: 'source-map',
    optimization: {
        minimize: true,
        usedExports: true,
    },
});
