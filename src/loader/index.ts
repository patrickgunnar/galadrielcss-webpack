import { LoaderContext } from "webpack";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import axios from "axios";

const GALADRIEL_TEMP_FILE_NAME = "galadrielcss_lothlorien_pipeline_port.txt";
const GALADRIEL_BUILD_FILE_LOCATION = ".galadrielcss/galadrielcss.json";
const IS_GALADRIEL_BUILD = process.env.NODE_ENV === "production";

const GALADRIEL_SERVER_ADDR = IS_GALADRIEL_BUILD
    ? null
    : getGaladrielServerAddr();

const GALADRIEL_BUILD_DATA = IS_GALADRIEL_BUILD
    ? loadGaladrielBuildContext()
    : null;

const REGEX =
    /@(?:class|layout|module):([a-zA-Z0-9_-]+)(?:::([a-zA-Z0-9_-]+))?/g;

type GaladrielBuildType = {
    css: string;
    trackingClasses: {
        central: Record<string, string>;
        layouts: Record<string, Record<string, string>>;
        modules: Record<string, Record<string, string>>;
    };
};

async function galadrielWebpackLoader(this: LoaderContext<{}>, source: string) {
    const callback = this.async();

    try {
        const transformedContent =
            typeof source === "string"
                ? source.includes("@galadrielcss styles;")
                    ? IS_GALADRIEL_BUILD
                        ? replaceCss(source)
                        : await asyncReplaceCss(source)
                    : IS_GALADRIEL_BUILD
                    ? replaceNenyrMakrup(source)
                    : await asyncReplaceNenyrMakrup(source)
                : source;

        callback(null, transformedContent);
    } catch (error) {
        error instanceof Error
            ? callback(error)
            : callback(new Error("An unknown error occurred"));
    }
}

async function asyncReplaceCss(source: string): Promise<string> {
    const css = (await axios.get(`${GALADRIEL_SERVER_ADDR}/fetch-css`)).data;

    return source.replace("@galadrielcss styles;", css);
}

async function asyncReplaceNenyrMakrup(source: string): Promise<string> {
    const matches = [...source.matchAll(REGEX)];
    const promises = matches.map(async (match) => {
        return await retrieveUtilityClassnames(match[0]);
    });

    const transformedMatches = await Promise.all(promises);
    let transformedSource = source;

    transformedMatches.forEach((transformedContent, index) => {
        transformedSource = transformedSource.replace(
            matches[index][0],
            transformedContent
        );
    });

    return transformedSource;
}

async function retrieveUtilityClassnames(match: string): Promise<string> {
    const formattedMatch = match.replace("::", "/").replace(":", "/");

    const requestUrl = match.startsWith("@class")
        ? `${GALADRIEL_SERVER_ADDR}/collect-utility-class-names/${formattedMatch}/none`
        : `${GALADRIEL_SERVER_ADDR}/collect-utility-class-names/${formattedMatch}`;

    return (await axios.get(requestUrl)).data;
}

function replaceCss(source: string): string {
    let css = GALADRIEL_BUILD_DATA?.css;

    return css ? source.replace("@galadrielcss styles;", css) : source;
}

function replaceNenyrMakrup(source: string): string {
    const trackingMap = GALADRIEL_BUILD_DATA?.trackingClasses;

    return source.replace(
        REGEX,
        (match: string, p1: string, p2: string): string => {
            let replaceValue: any = null;

            if (match.startsWith("@class")) {
                replaceValue = trackingMap?.central[p1];
            } else if (match.startsWith("@layout")) {
                replaceValue = trackingMap?.layouts[p1][p2];
            } else if (match.startsWith("@module")) {
                replaceValue = trackingMap?.modules[p1][p2];
            }

            return replaceValue ? replaceValue.replaceAll("\\", "") : match;
        }
    );
}

function getGaladrielServerAddr() {
    const galadrielTxtPath = join(tmpdir(), GALADRIEL_TEMP_FILE_NAME);
    const port = readFileSync(galadrielTxtPath).toString();

    return `http://127.0.0.1:${port}`;
}

function loadGaladrielBuildContext(): GaladrielBuildType {
    const buildContextLocation = join(
        process.cwd(),
        GALADRIEL_BUILD_FILE_LOCATION
    );
    const content = readFileSync(buildContextLocation).toString();

    return JSON.parse(content) as GaladrielBuildType;
}

export default galadrielWebpackLoader;
