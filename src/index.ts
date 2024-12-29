import { exec, execSync } from "node:child_process";
import {
    chmodSync,
    existsSync,
    mkdirSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { Compilation, Compiler, NormalModule } from "webpack";
import request from "sync-request";
import path from "node:path";
import os from "os";

const WEBPACK_CLIENT_NAME = "GaladrielWebpackClient";
const PRINT_TAB = "    ";

let hasRunGaladrielBuild = false;
let hasRemovedGaladrielDir = false;

const tempGaladrielDir = path.join(process.cwd(), ".galadrielcss", "bin");
const galadrielPath = path.join(tempGaladrielDir, "galadrielcss");

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
                        console.log("\n");
                        console.log(PRINT_TAB, "Installing Galadriel CSS...");

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
        const platform = os.platform();
        const architecture = os.arch();
        const patch = verifyOS(platform, architecture);

        return new Promise((resolve, reject) => {
            if (patch !== null) {
                console.log(
                    PRINT_TAB,
                    "Starting installation of Galadriel CSS..."
                );

                const downloadUrl = `https://github.com/patrickgunnar/galadrielcss/releases/latest/download/galadrielcss-${patch}${
                    platform === "win32" ? ".exe" : ""
                }`;

                console.log(
                    PRINT_TAB,
                    `Downloading Galadriel CSS binary for: ${patch}`
                );

                try {
                    const response = request("GET", downloadUrl);

                    console.log(
                        PRINT_TAB,
                        "Galadriel CSS binary downloaded successfully!"
                    );

                    createFolderPathSync(tempGaladrielDir);
                    writeFileSync(galadrielPath, response.getBody());
                    // Grant execute permissions to the binary
                    chmodSync(galadrielPath, 0o755);

                    console.log(
                        PRINT_TAB,
                        `Galadriel CSS binary installed at: ${galadrielPath}`
                    );

                    resolve();
                } catch (error: any) {
                    console.error(
                        PRINT_TAB,
                        "Error during installation:",
                        error.message
                    );
                    console.error(PRINT_TAB, "Stack trace:", error.stack);

                    reject(error);
                }
            }
        });
    }

    async startGaladrielBuild(): Promise<void> {
        return new Promise((resolve, reject) => {
            const process = exec(
                `npx ${galadrielPath} build`,
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
            const webpackLoaderPath = path.resolve(
                "node_modules",
                "@galadrielcss",
                "webpack",
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
        const galadrielTempFolderPath = path.join(
            process.cwd(),
            ".galadrielcss"
        );

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

function verifyOS(platform: string, architecture: string): string | null {
    console.log(
        PRINT_TAB,
        `Detecting OS and architecture: ${platform} - ${architecture}`
    );

    if (platform === "darwin") {
        return architecture.includes("x64")
            ? "x86_64-apple-darwin"
            : "aarch64-apple-darwin";
    } else if (platform === "win32" && architecture.includes("x64")) {
        return "x86_64-pc-windows-msvc";
    } else if (platform === "linux" && architecture.includes("x64")) {
        try {
            const result = execSync("ldd $(which ls)", { encoding: "utf-8" });

            if (result.includes("musl")) {
                return "x86_64-unknown-linux-musl";
            } else if (result.includes("libc.so")) {
                return "x86_64-unknown-linux-gnu";
            }
        } catch (error: any) {
            console.error("Error detecting Linux distribution:", error.message);
        }
    }

    console.log(
        "Your operating system is currently unsupported. Galadriel CSS cannot run on this system."
    );

    return null;
}

export default WebpackClient;
