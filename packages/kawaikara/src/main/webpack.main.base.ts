import path from 'path';
import { Configuration } from 'webpack';

const packageRoot = path.resolve(__dirname, '../..');
const externalizeNodeModule = (
    { request }: { request?: string },
    callback: (error?: Error | null, result?: string) => void,
) => {
    if (!request || request.startsWith('.') || path.isAbsolute(request)) {
        callback();
        return;
    }

    callback(null, `commonjs2 ${request}`);
};

const config: Configuration = {
    entry: path.resolve(__dirname, 'electron.ts'),
    target: 'electron-main',
    output: {
        path: path.resolve(packageRoot, 'dist/main'),
        filename: 'main.js',
        clean: true,
    },
    node: {
        __dirname: false,
        __filename: false,
    },
    externals: [externalizeNodeModule],
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        configFile: path.resolve(__dirname, 'tsconfig.json'),
                        transpileOnly: true,
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
