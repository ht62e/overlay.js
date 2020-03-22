const path = require('path');

module.exports = {
    mode: "production",
    //mode: "development",
    entry: "./src/main/overlay.ts",
    output: {
        filename: "overlay-min.js",
        path: path.join(__dirname, "./build/umd"),
        library: "Overlayjs",
        libraryTarget: "umd"
    },
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