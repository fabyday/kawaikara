import path from 'path';
import { Configuration } from 'webpack';

const kawaikaraRoot = path.dirname(require.resolve(`kawaikara/package.json`));

const baseConfig: Configuration = {
    mode: 'development',
    entry: path.resolve(__dirname, 'entry.ts'),
    target: 'electron-preload',
    output: {
        path: path.resolve(kawaikaraRoot, 'dist/preload'),
        filename: 'entry.js',
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        // 메인 프로세스용 tsconfig 연결
                        configFile: path.resolve(__dirname, 'tsconfig.json'),
                    },
                },
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
};

export default baseConfig;
