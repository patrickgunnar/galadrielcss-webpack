import {
    chmodSync,
    createWriteStream,
    existsSync,
    mkdirSync,
    rmSync,
} from "node:fs";
import { Compilation, Compiler, NormalModule } from "webpack";
import { execSync, spawn } from "node:child_process";
import path from "node:path";
import axios from "axios";
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
                this.handleNormalModuleHooks(compilation);
            }
        );

        if (process.env.NODE_ENV === "production") {
            this.setupProductionHooks(compiler);
        }
    }

    private handleNormalModuleHooks = (compilation: Compilation) => {
        const NormalModule = compilation.compiler.webpack?.NormalModule;

        const isNormalModuleAvailable =
            Boolean(NormalModule) && Boolean(NormalModule.getCompilationHooks);

        if (isNormalModuleAvailable) {
            NormalModule.getCompilationHooks(compilation).beforeLoaders.tap(
                WEBPACK_CLIENT_NAME,
                this.processNormalModuleRequest
            );
        } else {
            compilation.hooks.normalModuleLoader.tap(
                WEBPACK_CLIENT_NAME,
                this.processNormalModuleRequest
            );
        }
    };

    private setupProductionHooks = (compiler: Compiler) => {
        if (!hasRunGaladrielBuild) {
            hasRunGaladrielBuild = true;

            compiler.hooks.beforeRun.tapPromise(
                WEBPACK_CLIENT_NAME,
                this.handleBeforeRun
            );
        }

        compiler.hooks.done.tapPromise(
            WEBPACK_CLIENT_NAME,
            this.cleanupAfterBuild
        );
    };

    private handleBeforeRun = async () => {
        console.log("\n");
        console.log(PRINT_TAB, "Installing Galadriel CSS...");

        try {
            await this.installGaladrielCss();
            console.log(PRINT_TAB, "Starting the Galadriel CSS build...\n\n");
            await this.startGaladrielBuild();
        } catch (error) {
            console.error(
                PRINT_TAB,
                "Error during installation or build:",
                error
            );
        }
    };

    private cleanupAfterBuild = async () => {
        if (!hasRemovedGaladrielDir) {
            hasRemovedGaladrielDir = true;
            this.removeGaladrielTempFolder();
        }
    };

    private installGaladrielCss = async (): Promise<void> => {
        const platform = os.platform();
        const architecture = os.arch();
        const patch = this.verifyOS(platform, architecture);

        if (patch === null) {
            throw new Error(
                "Unsupported OS or architecture. Galadriel CSS cannot run."
            );
        }

        this.createFolderPathSync(tempGaladrielDir);

        const downloadUrl = `https://github.com/patrickgunnar/galadrielcss/releases/latest/download/galadrielcss-${patch}${
            platform === "win32" ? ".exe" : ""
        }`;

        console.log(PRINT_TAB, "Starting installation of Galadriel CSS...");

        const writer = createWriteStream(galadrielPath);

        try {
            const response = await axios.get(downloadUrl, {
                responseType: "stream",
                timeout: 15000,
            });

            if (response.status !== 200) {
                throw new Error(
                    `Failed to download Galadriel CSS. HTTP status: ${response.status}`
                );
            }

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                // Handle write stream errors
                writer.on("error", (err) => {
                    console.error(
                        PRINT_TAB,
                        `File write error for ${galadrielPath}: ${err.message}`
                    );

                    reject(err);
                });

                writer.on("finish", () => {
                    if (existsSync(galadrielPath)) {
                        chmodSync(galadrielPath, 0o755); // Grant execute permissions
                        console.log(
                            PRINT_TAB,
                            "Galadriel CSS binary installed successfully!"
                        );

                        resolve();
                    } else {
                        reject(new Error("Galadriel CSS binary not found!"));
                    }
                });
            });
        } catch (error: any) {
            console.error(
                PRINT_TAB,
                `Failed to install Galadriel CSS: ${error.message}`
            );

            writer.close(); // Ensure the writer is closed
            throw error;
        }
    };

    private async startGaladrielBuild(): Promise<void> {
        return new Promise((resolve, reject) => {
            const process = spawn("npx", [galadrielPath, "build"], {
                stdio: ["pipe", "pipe", "pipe"],
            });

            process.stdout.on("data", (data) => {
                console.log(data.toString());
            });

            process.stderr.on("data", (data) => {
                console.error(data.toString());
            });

            process.on("close", (code) => {
                if (code === 0) {
                    console.log(
                        PRINT_TAB,
                        "Galadriel CSS build completed successfully."
                    );
                    resolve();
                } else {
                    reject(
                        new Error(`Process finished with error code: ${code}`)
                    );
                }
            });

            process.on("error", (err) => {
                reject(
                    new Error(
                        `Error executing Galadriel CSS build: ${err.message}`
                    )
                );
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

            if (!hasLoader) {
                normalModule.loaders.push({
                    loader: webpackLoaderPath,
                    type: "javascript/auto",
                    ident: "galadrielcss-webpack-loader",
                    options: undefined,
                });
            }
        }
    };

    private shouldProcessFile(filename: string): boolean {
        return /\.(js|jsx|ts|tsx|css|md|mdx)$/.test(filename);
    }

    private removeGaladrielTempFolder() {
        const galadrielTempFolderPath = path.join(
            process.cwd(),
            ".galadrielcss"
        );

        if (existsSync(galadrielTempFolderPath)) {
            rmSync(galadrielTempFolderPath, { recursive: true, force: true });
            console.log(
                PRINT_TAB,
                "The Galadriel CSS dependency folder has been removed."
            );
        }
    }

    private createFolderPathSync(fullPath: string) {
        try {
            mkdirSync(fullPath, { recursive: true });
        } catch (error: any) {
            console.error(
                `Failed to create path "${fullPath}":`,
                error.message
            );
        }
    }

    private verifyOS = (
        platform: string,
        architecture: string
    ): string | null => {
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
            return this.detectLinuxDistro();
        }

        return null;
    };

    private detectLinuxDistro(): string | null {
        try {
            const result = execSync("ldd $(which ls)", { encoding: "utf-8" });
            if (result.includes("musl")) {
                return "x86_64-unknown-linux-musl";
            }
        } catch (error: any) {
            console.error("Error detecting Linux distro:", error.message);
            console.log("Defaulting to x86_64-unknown-linux-gnu.");
        }

        return "x86_64-unknown-linux-gnu";
    }
}

export default WebpackClient;
