const path = require('path');
const webpack = require('webpack');

module.exports = {
    mode: "production",
    //mode: "development",
    entry: "./src/main/overlayjs.ts",
    output: {
        filename: "overlay-min.js",
        path: path.join(__dirname, "./build/umd"),
        library: "Overlayjs",
        libraryTarget: "umd"
    },
    plugins: [
        new webpack.BannerPlugin({
          banner: "overlay.js | Copyright (c) 2020 Ryota Takaki | MIT license"
        })
      ],
    module: {
        rules: [
            {
                test: /\.ts(x*)?$/,
                exclude: /node_modules/,
                use: {
                    loader: "ts-loader",
                    options: {
                        configFile: "tsconfig.umd.json"
                    }
                }
            }
        ]
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js"]
    }
};