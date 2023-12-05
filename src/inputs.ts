import * as core from "@actions/core";

import { Inputs } from "./constants";
import * as utils from "./utils/action";

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

export const failOn: FailOn | undefined = (() => {
    const failOnRaw = new RegExp(
        "^(primary|first-match)\\.(miss|not-restored)$"
    )
        .exec(core.getInput(Inputs.FailOn))
        ?.slice(1);

    if (!failOnRaw) {
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

export const nix = utils.getInputAsBool(Inputs.Nix);

export const save = utils.getInputAsBool(Inputs.Save);

export const paths = (
    nix ? ["/nix/", "~/.cache/nix", "~root/.cache/nix"] : []
).concat(
    (() => {
        const paths = utils.getInputAsArray(Inputs.Paths);
        const pathsPlatform = utils.getInputAsArray(
            utils.isLinux ? Inputs.PathsLinux : Inputs.PathsMacos
        );
        if (pathsPlatform.length > 0) {
            return pathsPlatform;
        } else return paths;
    })()
);

export const gcMaxStoreSize = nix
    ? (() => {
          const gcMaxStoreSize = utils.getInputAsInt(Inputs.GCMaxStoreSize);
          const gcMaxStoreSizePlatform = utils.getInputAsInt(
              utils.isLinux
                  ? Inputs.GCMaxStoreSizeLinux
                  : Inputs.GCMaxStoreSizeMacos
          );
          return gcMaxStoreSizePlatform
              ? gcMaxStoreSizePlatform
              : gcMaxStoreSize;
      })()
    : undefined;

export const purge = utils.getInputAsBool(Inputs.Purge);

export const purgeOverwrite = (() => {
    const purgeOverwrite = core.getInput(Inputs.PurgeOverwrite);

    if (!(purgeOverwrite == "always" || purgeOverwrite == "never")) {
        return "default";
    }

    return purgeOverwrite;
})();

export const purgePrefixes = utils
    .getInputAsArray(Inputs.PurgePrefixes)
    .map(prefix => prefix.trim())
    .filter(prefix => prefix.length > 0);

export const purgeLastAccessed = utils.getInputAsInt(Inputs.PurgeLastAccessed);

export const purgeCreatedMaxAge = utils.getInputAsInt(Inputs.PurgeCreated);

export const uploadChunkSize =
    utils.getInputAsInt(Inputs.UploadChunkSize) || 32 * 1024 * 1024;

export const token = core.getInput(Inputs.Token);
