const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const path = require("path");
const webpack = require('webpack');


module.exports = (env, options) => {
    const devMode = options.mode === 'production';

return {
  mode : devMode ? "production" : "development",
  entry: {main : __dirname + "react_src/mainWindow/mainwindow.tsx", preference : __dirname + "react_src/preferenceWindow/preference.tsx"},
  output : {
    path : __dirname+"/react_build",
    filename : "[name].js",
    publicPath: '/'
  },
  resolve : {
    extensions: [".js", ".jsx", ".ts", ".tsx"],
  },
  devServer: {
    port: 3000,
    hot: true,
    open:true,

    historyApiFallback: true,
    host:'localhost'
  },
  module: {
    rules: [  
      { 
        test: /\.(ts|js)x?$/,
        exclude: "/node_modules/",
        // use: ["babel-loader", "ts-loader" ],
        use :{
          loader: "babel-loader",
          options: {
            presets: [
              "@babel/preset-env",
              "@babel/preset-react",
              "@babel/preset-typescript",
            ],
          },
        },
      }
    ],
  },
  plugins: [ new webpack.ProvidePlugin({
    React: "react",
}),
    new HtmlWebpackPlugin({
      template: './react_src/mainWindow/mainwindow.html',
                minify: process.env.NODE_ENV === 'production' ? {
                    collapseWhitespace: true, // remove empty
                    removeComments: true, // remove comment
                } : false,
                filename : "preference.html",
                chunks : ["preference"]
    }),
    
    new HtmlWebpackPlugin({
      template: './react_src/preferenceWindow/preference.html',
                minify: process.env.NODE_ENV === 'production' ? {
                    collapseWhitespace: true, // remove empty
                    removeComments: true, // remove comment
                } : false,
                filename : "main.html",
                chunks : ["main"]
    }),
    new CleanWebpackPlugin()

  ],
  
}
};