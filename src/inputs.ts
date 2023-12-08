import * as core from "@actions/core";

import { Inputs } from "./constants";
import * as utils from "./utils/action";

export const key = core.getInput(Inputs.Key, { required: true });

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

export const restoreFirstMatchKeys = utils.getInputAsArray(
    Inputs.RestoreFirstMatchKeys
);
export const restoreFirstMatchHit = utils.getInputAsBool(
    Inputs.RestoreFirstMatchHit
);
export const restoreAllMatchesKeys = utils.getInputAsArray(
    Inputs.RestoreAllMatchesKeys
);

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

export const purgeAccessedMaxAge = utils.getInputAsInt(
    Inputs.PurgeLastAccessedMaxAge
);

export const purgeCreatedMaxAge = utils.getInputAsInt(
    Inputs.PurgeCreatedMaxAge
);

export const uploadChunkSize = utils.getInputAsInt(Inputs.UploadChunkSize);

export const failOnCacheMiss = utils.getInputAsBool(Inputs.FailOnCacheMiss);

export const lookupOnlyOnKeyHit = utils.getInputAsBool(
    Inputs.LookupOnlyOnKeyHit
);

export const token = core.getInput(Inputs.Token, { required: true });
