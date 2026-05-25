import path from 'path';
import { Configuration, ProvidePlugin } from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';

const packageRoot = path.resolve(__dirname, '../..');

type RendererEntry = {
    title: string;
    entry: string;
    template: string;
    html: string;
};

const rendererEntries: Record<string, RendererEntry> = {
    main: {
        title: 'Kawaikara',
        entry: path.resolve(__dirname, 'mainWindow/mainwindow.tsx'),
        template: path.resolve(__dirname, 'mainWindow/mainwindow.html'),
        html: 'main.html',
    },
    preference: {
        title: 'Kawaikara Preferences',
        entry: path.resolve(__dirname, 'preferenceWindow/preference.tsx'),
        template: path.resolve(__dirname, 'preferenceWindow/preference.html'),
        html: 'preference.html',
    },
    sidebar: {
        title: 'Kawaikara Menu',
        entry: path.resolve(__dirname, 'sidebar/sidebar.tsx'),
        template: path.resolve(__dirname, 'sidebar/sidebar.html'),
        html: 'sidebar.html',
    },
    bgtaskview: {
        title: 'Kawaikara Background Tasks',
        entry: path.resolve(__dirname, 'bgTaskWindow/mainwindow.tsx'),
        template: path.resolve(__dirname, 'bgTaskWindow/mainwindow.html'),
        html: 'bgtaskview.html',
    },
    redirect: {
        title: 'Kawaikara Redirect',
        entry: path.resolve(__dirname, 'redirectWindow/mainwindow.tsx'),
        template: path.resolve(__dirname, 'redirectWindow/mainwindow.html'),
        html: 'redirect.html',
    },
    info: {
        title: 'Kawaikara Info',
        entry: path.resolve(__dirname, 'infoWindow/mainwindow.tsx'),
        template: path.resolve(__dirname, 'infoWindow/mainwindow.html'),
        html: 'info.html',
    },
    plugin: {
        title: 'Kawaikara Plugins',
        entry: path.resolve(__dirname, 'PluginWindow/mainwindow.tsx'),
        template: path.resolve(__dirname, 'PluginWindow/mainwindow.html'),
        html: 'plugin.html',
    },
    console: {
        title: 'Kawaikara Console',
        entry: path.resolve(__dirname, 'consoleWindow/mainwindow.tsx'),
        template: path.resolve(__dirname, 'consoleWindow/mainwindow.html'),
        html: 'console.html',
    },
    videoview: {
        title: 'Kawaikara Video Viewer',
        entry: path.resolve(__dirname, 'videoViewerWindow/mainwindow.tsx'),
        template: path.resolve(__dirname, 'videoViewerWindow/mainwindow.html'),
        html: 'videoview.html',
    },
    update: {
        title: 'Kawaikara Update',
        entry: path.resolve(__dirname, 'updateWindow/update.tsx'),
        template: path.resolve(__dirname, 'updateWindow/update.html'),
        html: 'update.html',
    },
};

const config: Configuration = {
    entry: Object.fromEntries(
        Object.entries(rendererEntries).map(([name, view]) => [
            name,
            view.entry,
        ]),
    ),
    target: 'electron-renderer',
    output: {
        path: path.resolve(packageRoot, 'dist/pages'),
        filename: '[name].js',
        publicPath: './',
        clean: true,
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        configFile: path.resolve(__dirname, 'tsconfig.json'),
                        transpileOnly: true,
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
        new ProvidePlugin({
            React: 'react',
        }),
        ...Object.entries(rendererEntries).map(
            ([name, view]) =>
                new HtmlWebpackPlugin({
                    filename: view.html,
                    title: view.title,
                    chunks: [name],
                    template: view.template,
                }),
        ),
    ],
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        fallback: {
            fs: false,
            path: false,
        },
    },
};

export default config;
