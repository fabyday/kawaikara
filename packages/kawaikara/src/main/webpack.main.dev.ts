import path from 'path';
import { Configuration } from 'webpack';
const kawaikaraRoot = path.dirname(require.resolve(`kawaikara/package.json`));

const config: Configuration = {
    mode: 'development',
    entry: path.resolve(__dirname, 'electron.ts'), // 메인 프로세스 시작점
    target: 'electron-main', // 중요: 일렉트론 메인 타겟 설정
    output: {
        path: path.resolve(kawaikaraRoot, 'dist/main'),
        filename: 'main.js',
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

export default config;
