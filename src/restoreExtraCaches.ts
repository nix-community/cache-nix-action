import * as core from "@actions/core";

import { Inputs } from "./constants";
import * as utils from "./utils/actionUtils";

export async function restoreExtraCaches() {
    const extraRestoreKeys = utils.getInputAsArray(Inputs.ExtraRestoreKeys);

    if (extraRestoreKeys.length == 0) {
        return;
    }

    const token = core.getInput(Inputs.Token, { required: true });

    utils.info(
        `
        Restoring extra caches with keys:
        ${utils.stringify(extraRestoreKeys)}
        `
    );

    const results = await utils.getCachesByKeys(token, extraRestoreKeys);

    utils.info(
        `
        Found ${results.length} cache(s):
        ${utils.stringify(results)}
        `
    );

    const cachePaths = utils.paths;

    results.forEach(async cache => {
        utils.info(`Restoring a cache with the key ${cache.key}`);

        if (cache.key !== undefined) {
            const restoreKey = await utils.getCacheKey({
                paths: cachePaths,
                primaryKey: cache.key,
                restoreKeys: [],
                lookupOnly: false
            });

            if (restoreKey) {
                utils.info(`Restored a cache with the key ${cache.key}`);
            }
        }
    });
}
