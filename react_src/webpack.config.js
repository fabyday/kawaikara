const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const path = require("path");
const webpack = require('webpack');


module.exports = (env, options) => {
    const devMode = options.mode === 'production';
    console.log(options.mode)
  return {
  target: devMode ? ["web", 'electron-renderer'] : ["web"] ,
  mode : devMode ? "production" : "development",
  entry: {main : __dirname + "/mainWindow/mainwindow.tsx", preference : __dirname + "/preferenceWindow/preference.tsx", sidebar : __dirname+"/sidebar/sidebar.tsx",
    bgtaskview : __dirname + "/bgTaskWindow/mainwindow.tsx"
  },
  output : {
    path : __dirname+"/../public/pages",
    filename : "[name].js",
    publicPath:devMode ? './' : '/'
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
      template: './preferenceWindow/preference.html',
                minify: process.env.NODE_ENV === 'production' ? {
                    collapseWhitespace: true, // remove empty
                    removeComments: true, // remove comment
                } : false,
                filename : "preference.html",
                chunks : ["preference"]
    }),
    
    new HtmlWebpackPlugin({
      template: './mainWindow/mainwindow.html',
                minify: process.env.NODE_ENV === 'production' ? {
                    collapseWhitespace: true, // remove empty
                    removeComments: true, // remove comment
                } : false,
                filename : "main.html",
                chunks : ["main"]
    }),
    new HtmlWebpackPlugin({
      template: './sidebar/sidebar.html',
                minify: process.env.NODE_ENV === 'production' ? {
                    collapseWhitespace: true, // remove empty
                    removeComments: true, // remove comment
                } : false,
                filename : "sidebar.html",
                chunks : ["sidebar"]
    }),
    new HtmlWebpackPlugin({
      template: './bgTaskWindow/mainwindow.html',
                minify: process.env.NODE_ENV === 'production' ? {
                    collapseWhitespace: true, // remove empty
                    removeComments: true, // remove comment
                } : false,
                filename : "bgtaskview.html",
                chunks : ["bgtaskview"]
    }),
    new CleanWebpackPlugin()

  ],
  
}
};