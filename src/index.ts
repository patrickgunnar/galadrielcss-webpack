import { exec } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { Compilation, Compiler, NormalModule } from "webpack";

const WEBPACK_CLIENT_NAME = "GaladrielWebpackClient";
const PRINT_TAB = "    ";

let hasRunGaladrielBuild = false;
let hasRemovedGaladrielDir = false;

const tempGaladrielDir = join(process.cwd(), ".galadrielcss");
const execGaladrielPath = join(
    tempGaladrielDir,
    "node_modules",
    "galadrielcss"
);

class WebpackClient {
    apply(compiler: Compiler) {
        compiler.hooks.compilation.tap(
            WEBPACK_CLIENT_NAME,
            (compilation: Compilation) => {
                const NormalModule = compiler.webpack?.NormalModule;
                const isNormalModuleAvailable =
                    Boolean(NormalModule) &&
                    Boolean(NormalModule.getCompilationHooks);

                if (isNormalModuleAvailable) {
                    NormalModule.getCompilationHooks(
                        compilation
                    ).beforeLoaders.tap(
                        WEBPACK_CLIENT_NAME,
                        this.processNormalModuleRequest
                    );
                } else {
                    compilation.hooks.normalModuleLoader.tap(
                        WEBPACK_CLIENT_NAME,
                        this.processNormalModuleRequest
                    );
                }
            }
        );

        if (process.env.NODE_ENV === "production") {
            if (!hasRunGaladrielBuild) {
                hasRunGaladrielBuild = true;

                compiler.hooks.beforeRun.tapPromise(
                    WEBPACK_CLIENT_NAME,
                    async () => {
                        console.log(
                            "\n",
                            PRINT_TAB,
                            "Installing Galadriel CSS..."
                        );

                        await this.installGaladrielCss();

                        console.log(
                            PRINT_TAB,
                            "Starting the Galadriel CSS build...\n\n"
                        );

                        await this.startGaladrielBuild();
                    }
                );
            }

            compiler.hooks.done.tapPromise(WEBPACK_CLIENT_NAME, async (_) => {
                if (!hasRemovedGaladrielDir) {
                    hasRemovedGaladrielDir = true;

                    this.removeGaladrielTempFolder();
                }
            });
        }
    }

    async installGaladrielCss(): Promise<void> {
        createFolderPathSync(tempGaladrielDir);
        
        return new Promise((resolve, reject) => {
            const process = exec(
                `npm install /home/patrickgunnar/Desktop/galadrielcss.node/ --no-save --prefix ${tempGaladrielDir}`, // "npm install galadrielcss --no-save"
                (err, stdout, stderr) => {
                    if (err) {
                        reject(err);
                    } else {
                        if (stdout) console.log(stdout);
                        if (stderr) console.error(stderr);

                        console.log(
                            PRINT_TAB,
                            "Galadriel CSS installed successfully."
                        );

                        resolve();
                    }
                }
            );

            process.on("exit", (code) => {
                if (code !== 0) {
                    reject(
                        new Error(`Process finished with error code: {code}`)
                    );
                }
            });
        });
    }

    async startGaladrielBuild(): Promise<void> {
        return new Promise((resolve, reject) => {
            const process = exec(
                `npx ${execGaladrielPath} build`,
                (err, stdout, stderr) => {
                    if (err) {
                        reject(err);
                    } else {
                        if (stdout) console.log(stdout);
                        if (stderr) console.error(stderr);

                        console.log(
                            PRINT_TAB,
                            "Galadriel CSS build has completed successfully."
                        );

                        resolve();
                    }
                }
            );

            process.on("exit", (code) => {
                if (code !== 0) {
                    reject(
                        new Error(`Process finished with error code: {code}`)
                    );
                }
            });
        });
    }

    processNormalModuleRequest = (_: any, normalModule: NormalModule) => {
        if (this.shouldProcessFile(normalModule.userRequest)) {
            const webpackLoaderPath = resolve(
                "node_modules",
                "galadriel-webpack-client",
                "dist",
                "loader",
                "index.js"
            );

            const hasLoader = normalModule.loaders.some(
                (loader) => loader.loader === webpackLoaderPath
            );

            if (!hasLoader)
                normalModule.loaders.push({
                    loader: webpackLoaderPath,
                    type: "javascript/auto",
                    options: undefined,
                    ident: "galadrielcss-webpack-loader",
                });
        }
    };

    shouldProcessFile(filename: string): boolean {
        return /\.(js|jsx|ts|tsx|css|md|mdx)$/.test(filename);
    }

    removeGaladrielTempFolder() {
        const galadrielTempFolderPath = join(process.cwd(), ".galadrielcss");

        if (existsSync(galadrielTempFolderPath)) {
            rmSync(galadrielTempFolderPath, { recursive: true, force: true });

            console.log(
                PRINT_TAB,
                "The Galadriel CSS dependency folder has been successfully removed.\n\n"
            );
        }
    }
}

function createFolderPathSync(fullPath: string) {
    try {
        mkdirSync(fullPath, { recursive: true });
    } catch (error) {
        console.error(`Failed to create path "${fullPath}":`, error);
    }
}

export default WebpackClient;
