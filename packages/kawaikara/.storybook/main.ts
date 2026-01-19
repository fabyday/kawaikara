import type { StorybookConfig } from '@storybook/react-webpack5';

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */



const config: StorybookConfig = {
    stories: ['../src/renderer/**/*.mdx', '../src/renderer/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
    addons: [
        '@storybook/addon-webpack5-compiler-swc',
        '@storybook/addon-a11y',
        '@storybook/addon-docs',
        '@storybook/addon-essentials',
        {
            name: '@storybook/addon-styling-webpack',
            options: {
                rules: [
                    {
                        test: /\.css$/,
                        use: [
                            'style-loader',
                            'css-loader',
                            {
                                loader: 'postcss-loader',
                                options: {
                                    postcssOptions: {
                                        // renderer 안에 있는 postcss 설정을 명시적으로 로드
                                        config: 'src/renderer/postcss.config.ts',

                                        // config: resolve(
                                        //     __dirname,
                                        //     '../src/renderer/postcss.config.js',
                                        // ),
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        },
    ],
    framework: '@storybook/react-webpack5',
};
export default config;
