import * as core from "@actions/core";

import { Inputs } from "./constants";
import * as utils from "./utils/inputs";

export const primaryKey = core.getInput(Inputs.PrimaryKey, { required: true });

export const restorePrefixesFirstMatch = utils.getInputAsArray(
    Inputs.RestorePrefixesFirstMatch
);
export const restorePrefixesAllMatches = utils.getInputAsArray(
    Inputs.RestorePrefixesAllMatches
);

export const skipRestoreOnHitPrimaryKey = utils.getInputAsBool(
    Inputs.SkipRestoreOnHitPrimaryKey
);

interface FailOn {
    keyType: "primary" | "first-match";
    result: "miss" | "not-restored";
}

export const failOn: FailOn | undefined = (function () {
    const failOnRaw = new RegExp(
        "^(primary|first-match)\\.(miss|not-restored)$"
    )
        .exec(core.getInput(Inputs.FailOn))
        ?.slice(1);

    if (failOnRaw === undefined || failOnRaw.length != 2) {
        return;
    }

    const [keyType, result] = failOnRaw;
    if (
        (keyType == "primary" || keyType == "first-match") &&
        (result == "miss" || result == "not-restored")
    ) {
        return { keyType, result };
    }
})();

function choose<T>(linuxOption: T, macosOption: T, defaultOption: T): T {
    switch (process.env.RUNNER_OS) {
        case "Linux":
            return linuxOption;
        case "macOS":
            return macosOption;
        default:
            return defaultOption;
    }
}

export const nix =
    utils.getInputAsBool(Inputs.Nix) &&
    (process.env.RUNNER_OS === "Linux" || process.env.RUNNER_OS === "macOS");

export const paths = (
    nix ? ["/nix", "~/.cache/nix", "~root/.cache/nix"] : []
).concat(
    (function () {
        const paths = utils.getInputAsArray(Inputs.Paths);
        const pathsPlatform = utils.getInputAsArray(
            choose(Inputs.PathsLinux, Inputs.PathsMacos, Inputs.Paths)
        );
        if (pathsPlatform.length > 0) {
            return pathsPlatform;
        } else return paths;
    })()
);

export const save = utils.getInputAsBool(Inputs.Save);

export const gcMaxStoreSize = nix
    ? (function () {
          const gcMaxStoreSize = utils.getInputAsInt(Inputs.GCMaxStoreSize);
          const gcMaxStoreSizePlatform = utils.getInputAsInt(
              choose(
                  Inputs.GCMaxStoreSizeLinux,
                  Inputs.GCMaxStoreSizeMacos,
                  Inputs.GCMaxStoreSize
              )
          );
          return gcMaxStoreSizePlatform !== undefined
              ? gcMaxStoreSizePlatform
              : gcMaxStoreSize;
      })()
    : undefined;

export const purge = utils.getInputAsBool(Inputs.Purge);

export const purgePrimaryKey = (function () {
    const purgePrimaryKey = core.getInput(Inputs.PurgePrimaryKey);

    if (!(purgePrimaryKey == "always" || purgePrimaryKey == "never")) {
        return "default";
    }

    return purgePrimaryKey;
})();

export const purgePrefixes = utils.getInputAsArray(Inputs.PurgePrefixes);

export const purgeLastAccessed = utils.getInputAsInt(Inputs.PurgeLastAccessed);

export const purgeCreated = utils.getInputAsInt(Inputs.PurgeCreated);

export const uploadChunkSize =
    utils.getInputAsInt(Inputs.UploadChunkSize) || 32 * 1024 * 1024;

export const token = core.getInput(Inputs.Token, { required: true });
