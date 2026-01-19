import path from 'path';
import { Configuration } from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';

const kawaikaraRoot = path.dirname(require.resolve(`kawaikara/package.json`));

const config: Configuration = {
    mode: 'development',
    entry: {
        OverlayMenu: path.resolve(__dirname, 'view/OverlayMenu/App.tsx'),
        Preferences: path.resolve(__dirname, './view/Preferences/App.tsx'),
        BackgroundViewer: path.resolve(
            __dirname,
            './view/BackgroundViewer/App.tsx',
        ),
    }, // 리액트 시작점
    target: 'electron-renderer', // 중요: 일렉트론 렌더러 타겟 설정
    output: {
        path: path.resolve(kawaikaraRoot, './dist/renderer'),
        filename: 'renderer.js',
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        // 리액트용 tsconfig 연결
                        configFile: path.resolve(__dirname, 'tsconfig.json'),
                    },
                },
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader',
                    {
                        loader: 'postcss-loader',
                        options: {
                            postcssOptions: {
                                config: path.resolve(
                                    __dirname,
                                    'postcss.config.ts',
                                ),
                            },
                        },
                    },
                ],
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            filename: 'OverlayMenu.html',
            title: 'Overlay Menu',
            chunks: ['OverlayMenu'],
            template: path.resolve(__dirname, './Templates/index.html'), // 리액트가 담길 HTML 파일
        }),
        new HtmlWebpackPlugin({
            filename: 'Preferences.html',
            title: 'Preferences',
            chunks: ['Preferences'],
            template: path.resolve(__dirname, './Templates/index.html'), // 리액트가 담길 HTML 파일
        }),
        new HtmlWebpackPlugin({
            filename: 'BackgroundViewer.html',
            title: 'Background Viewer',
            chunks: ['BackgroundViewer'],
            template: path.resolve(__dirname, './Templates/index.html'), // 리액트가 담길 HTML 파일
        }),
    ],
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
};

export default config;
