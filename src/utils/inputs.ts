import * as core from "@actions/core";

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

    let result: number = 0;

    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const digit = parseInt(char);
        if (!isNaN(digit)) {
            result = result * 10 + digit;
        } else {
            if (i == chars.length - 1) {
                switch (char) {
                    case "K":
                        result <<= 10;
                        break;
                    case "M":
                        result <<= 20;
                        break;
                    case "G":
                        result <<= 30;
                        break;
                    default:
                        result = NaN;
                }
            } else {
                result = NaN;
                break;
            }
        }
    }

    return isNaN(result) ? undefined : { input, value: result };
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

export function getInputAsBool(
    name: string,
    options?: core.InputOptions
): boolean {
    const result = core.getInput(name, options);
    return result.toLowerCase() === "true";
}
