import * as core from "@actions/core";

import { Inputs } from "./constants";
import * as utils from "./utils/actionUtils";

export async function restoreExtraCaches(
    cachePaths: string[],
    lookupOnly: boolean,
    enableCrossOsArchive: boolean
) {
    const extraRestoreKeys = utils.getInputAsArray(Inputs.ExtraRestoreKeys);

    if (extraRestoreKeys.length == 0) {
        return;
    }

    const token = core.getInput(Inputs.Token, { required: false });

    core.info(
        `Restoring extra caches with keys ${JSON.stringify(extraRestoreKeys)}.`
    );

    const results = await utils.getCachesByKeys(token, extraRestoreKeys);

    core.info(
        `Found ${results.length} cache(s)\n${JSON.stringify(
            results
        )}\n\n`
    );

    if (lookupOnly) {
        return;
    }

    results.forEach(async cache => {
        core.info(`Restoring a cache with the key ${cache.key}`);

        if (cache.key !== undefined) {
            const restoreKey = await utils.getCacheKey(
                cachePaths,
                cache.key,
                [],
                false,
                enableCrossOsArchive
            );

            if (restoreKey) {
                core.info(`Restored a cache with the key ${cache.key}`);
            }
        }
    });
}
