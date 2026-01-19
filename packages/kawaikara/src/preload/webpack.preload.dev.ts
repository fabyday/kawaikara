import { merge } from 'webpack-merge';
import baseConfig from './webpack.preload.base';

export default merge(baseConfig, {
    mode: 'development',
    devtool: 'source-map', // keep source maps for easier debugging
    optimization: {
        minimize: false, // when in development, do not minimize for easier debugging
        usedExports: false, // disable tree shaking in development
    },
    // 개발 모드에서만 필요한 플러그인이 있다면 여기에 추가
});
