import { merge } from 'webpack-merge';
import baseConfig from './webpack.renderer.base';

export default merge(baseConfig, {
    mode: 'production',
    devtool: 'source-map', // keep source maps for easier debugging
    optimization: {
        minimize: true, // when in development, do not minimize for easier debugging
        usedExports: true, // disable tree shaking in development
    },
});
