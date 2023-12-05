import * as core from "@actions/core";

import { Events, Inputs, Outputs, State } from "./constants";
import { restoreExtraCaches } from "./restoreExtraCaches";
import { IStateProvider } from "./stateProvider";
import * as utils from "./utils/actionUtils";

export async function restoreWithKey(key: string, paths: string[]) {
    utils.info(`Restoring a cache with the key "${key}".`);

    utils.info(
        `::group::Logs are hidden. Errors are due to attempts to overwrite read-only paths.`
    );

    await utils.getCacheKey({
        paths,
        primaryKey: key,
        restoreKeys: [],
        lookupOnly: false
    });

    utils.info(`::endgroup::`);

    utils.info(`Finished restoring the cache.`);
}

async function restoreImpl(
    stateProvider: IStateProvider
): Promise<string | undefined> {
    try {
        if (!utils.isCacheFeatureAvailable()) {
            core.setOutput(Outputs.CacheHit, "false");
            return;
        }

        // Validate inputs, this can cause task failure
        if (!utils.isValidEvent()) {
            throw new Error(
                `Event Validation Error: The event type ${
                    process.env[Events.Key]
                } is not supported because it's not tied to a branch or tag ref.`
            );
        }

        const primaryKey = core.getInput(Inputs.Key, { required: true });
        stateProvider.setState(State.CachePrimaryKey, primaryKey);

        const restoreKeys = utils.getInputAsArray(Inputs.RestoreKeys);
        const cachePaths = utils.paths;
        const failOnCacheMiss = utils.getInputAsBool(Inputs.FailOnCacheMiss);
        const restoreKeyHit = utils.getInputAsBool(Inputs.RestoreKeyHit);

        utils.info(`Searching for a cache with the key "${primaryKey}".`);

        let cacheKey = await utils.getCacheKey({
            paths: cachePaths,
            primaryKey,
            restoreKeys: [],
            lookupOnly: true
        });

        if (cacheKey) {
            await restoreWithKey(cacheKey, cachePaths);
        } else {
            utils.info(
                `
                No cache with the given primary key found.
                Searching for a cache using restore keys:
                ${JSON.stringify(restoreKeys)}
                `
            );

            const restoreKey = await utils.getCacheKey({
                paths: cachePaths,
                primaryKey: "",
                restoreKeys,
                lookupOnly: true
            });

            if (restoreKey) {
                await restoreWithKey(restoreKey, cachePaths);
            }

            if (restoreKeyHit) {
                cacheKey = restoreKey;
            }
        }

        if (!cacheKey) {
            if (failOnCacheMiss) {
                throw new Error(
                    `
                    Failed to restore a cache with the key "${primaryKey}".
                    Exiting as ${Inputs.FailOnCacheMiss} is set. 
                    `
                );
            }
            utils.info(
                `
                Cache not found for input keys:
                ${utils.stringify([primaryKey, ...restoreKeys])}
                `
            );

            await restoreExtraCaches();

            return;
        }

        // Store the matched cache key in states
        stateProvider.setState(State.CacheMatchedKey, cacheKey);

        const isExactKeyMatch =
            utils.isExactKeyMatch(
                core.getInput(Inputs.Key, { required: true }),
                cacheKey
            ) || restoreKeyHit;

        core.setOutput(Outputs.CacheHit, isExactKeyMatch.toString());

        utils.info(`Cache restored from key: "${cacheKey}"`);

        await restoreExtraCaches();

        return cacheKey;
    } catch (error: unknown) {
        core.setFailed((error as Error).message);
    }
}

export default restoreImpl;
