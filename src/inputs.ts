import * as core from "@actions/core";

import { Inputs } from "./constants";
import * as utils from "./utils/action";

export const key = core.getInput(Inputs.PrimaryKey, { required: true });

export const paths = ["/nix/", "~/.cache/nix", "~root/.cache/nix"].concat(
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

export const restoreFirstMatchKeyPrefixes = utils.getInputAsArray(
    Inputs.RestoreFirstMatchKeyPrefixes
);
export const restoreAllMatchesKeyPrefixes = utils.getInputAsArray(
    Inputs.RestoreAllMatchesKeyPrefixes
);

export const skipRestoreOnPrimaryKeyHit = utils.getInputAsBool(
    Inputs.SkipRestoreOnPrimaryKeyHit
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

export const gcMaxStoreSize = (() => {
    const gcMaxStoreSize = utils.getInputAsInt(Inputs.GCMaxStoreSize);
    const gcMaxStoreSizePlatform = utils.getInputAsInt(
        utils.isLinux ? Inputs.GCMaxStoreSizeLinux : Inputs.GCMaxStoreSizeMacos
    );
    return gcMaxStoreSizePlatform ? gcMaxStoreSizePlatform : gcMaxStoreSize;
})();

export const purge = utils.getInputAsBool(Inputs.Purge);

export const purgeOverwrite = (() => {
    const purgeOverwrite = core.getInput(Inputs.PurgeOverwrite);

    if (!(purgeOverwrite == "always" || purgeOverwrite == "never")) {
        return "default";
    }

    return purgeOverwrite;
})();

export const purgeKeys = utils.getInputAsArray(Inputs.PurgeKeys);

export const purgeLastAccessedMaxAge = utils.getInputAsInt(
    Inputs.PurgeLastAccessedMaxAge
);

export const purgeCreatedMaxAge = utils.getInputAsInt(
    Inputs.PurgeCreatedMaxAge
);

export const uploadChunkSize = utils.getInputAsInt(Inputs.UploadChunkSize);

export const token = core.getInput(Inputs.Token, { required: true });
