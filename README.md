# Installing and Instantiating the Integration Client for Webpack

The integration client for Galadriel CSS integrates seamlessly with Webpack to streamline the processing of Nenyr styles. Follow these steps to set up and instantiate the client in your Webpack workflow.

## Installation

To get started, you need to install the integration client package via npm or yarn:

### Using npm:

```bash
npm install @galadrielcss/webpack
```

### Using yarn:

```bash
yarn add @galadrielcss/webpack
```

Once installed, the package is ready to be used in your Webpack configuration.

## Setup and Configuration

To use the integration client, import it into your Webpack configuration file and include it in the `plugins` array. Here's how:

### Example Webpack Configuration

Create or update your `webpack.config.js` file to include the Galadriel CSS integration client:

```javascript
// Import the Galadriel CSS Webpack Integration Client
import GaladrielWebpackClient from "@galadrielcss/webpack";

// or, if using CommonJS
// const GaladrielWebpackClient = require("@galadrielcss/webpack");

export default {
    entry: "./src/index.js", // Your application's entry point
    output: {
        path: __dirname + "/dist", // Output directory
        filename: "bundle.js", // Output file name
    },
    plugins: [
        new GaladrielWebpackClient(), // Instantiate the integration client
        // Add other plugins here
    ],
    module: {
        rules: [
            {
                test: /\.(js|jsx|ts|tsx)$/, // Match JavaScript and TypeScript files
                exclude: /node_modules/,
                use: "babel-loader", // Example loader
            },
            {
                test: /\.css$/, // Match CSS files
                use: ["style-loader", "css-loader"],
            },
        ],
    },
};
```

### Notes on Loader Integration

The integration client works seamlessly with other Webpack loaders. To ensure proper execution, it:

-   Detects and transforms Nenyr markups before any other loader processes the files.
-   Operates harmoniously with additional loaders, such as prefixing tools, to preserve workflow compatibility.

## Development Mode Requirements

During development, you must start the **Galadriel CSS development server** before launching your application’s development server. This ensures real-time style updates.

### Starting the Development Server

1. Run the Galadriel CSS development server using the command provided in its documentation.
2. Then, start your application's development server.

If the development server for Galadriel CSS is not running, the integration client will detect this and raise an error to prevent styling discrepancies.

## Build Mode Configuration

In Build Mode, the integration client:

-   Processes styles using a precompiled JSON file containing mappings for Nenyr classes and CSS rules.
-   Injects optimized utility classes and styles into the final build output.
-   Ensures a clean, lightweight production bundle by removing the JSON file post-build.

No additional setup is required for Build Mode. The integration client automates all style processing during the build phase.

## Summary

By following these steps, you can:

-   Install and configure the Galadriel CSS integration client.
-   Enjoy real-time style updates in Development Mode.
-   Automate style processing for production builds.

With its robust integration, the Galadriel CSS integration client ensures a streamlined and efficient workflow, maximizing your productivity.
