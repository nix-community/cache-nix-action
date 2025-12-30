import dedent from "dedent";
import * as core from "@actions/core";

const myDedent = dedent.withOptions({});

export const info = (message: string) => core.info(myDedent(message));

export const warning = (message: string) => core.warning(myDedent(message));

export function logWarning(message: string): void {
    const warningPrefix = "[warning]";
    core.warning(`${warningPrefix} ${message}`);
}

export function logError(message: string): void {
    const prefix = "[error]";
    core.error(`${prefix} ${message}`);
}
