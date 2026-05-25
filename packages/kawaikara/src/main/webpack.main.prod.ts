import { merge } from 'webpack-merge';
import baseConfig from './webpack.main.base';

export default merge(baseConfig, {
    mode: 'production',
    optimization: {
        minimize: true,
        usedExports: true,
    },
});
