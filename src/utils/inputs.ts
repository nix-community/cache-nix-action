import * as core from "@actions/core";
import { Temporal } from "temporal-polyfill";
import { logWarning } from "./log";

export function getInputAsArray(
    name: string,
    options?: core.InputOptions
): string[] {
    return core
        .getInput(name, options)
        .split("\n")
        .map(s => s.replace(/^!\s+/, "!").trim())
        .filter(x => x !== "");
}

// https://github.com/NixOS/nix/blob/a047dec120672d00e069bacf10ffdda420fd1048/src/libutil/util.hh#L88
export function parseNixGcMax(name: string, options?: core.InputOptions) {
    const input = core.getInput(name, options);

    const chars = [...input];

    if (chars.length == 0) {
        return undefined;
    }

    let result: bigint = 0n;
    let invalidNumber: bigint = -1n;

    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const digit = parseInt(char);
        if (!isNaN(digit)) {
            result = result * 10n + BigInt(digit);
        } else {
            if (i == chars.length - 1) {
                switch (char) {
                    case "K":
                        result <<= 10n;
                        break;
                    case "M":
                        result <<= 20n;
                        break;
                    case "G":
                        result <<= 30n;
                        break;
                    default:
                        result = invalidNumber;
                }
            } else {
                result = invalidNumber;
                break;
            }
        }
    }

    return result === invalidNumber ? undefined : { input, value: result };
}

export function getInputAsInt(
    name: string,
    options?: core.InputOptions
): number | undefined {
    const value = parseInt(core.getInput(name, options));
    if (isNaN(value) || value < 0) {
        return undefined;
    }
    return value;
}

export function getInputAsDuration(
    name: string,
    options?: core.InputOptions
): Temporal.Duration | undefined {
    const input = core.getInput(name, options);

    if (input == "") {
        return undefined;
    }

    const value = parseInt(input);

    function message(problem: string): string {
        return `
            Bad value of the input "${name}": ${problem}.
            The value must be a non-negative number or a string in the ISO 8601 duration format.
            See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/Duration#iso_8601_duration_format
        `;
    }

    if (value < 0) {
        logWarning(message(`a negative number "${input}"`));
        return undefined;
    }
    try {
        return Temporal.Duration.from(value >= 0 ? { seconds: value } : input);
    } catch (error: unknown) {
        logWarning(message((error as Error).message));
        return undefined;
    }
}

export function getInputAsBool(
    name: string,
    options?: core.InputOptions
): boolean {
    const result = core.getInput(name, options);
    return result.toLowerCase() === "true";
}
