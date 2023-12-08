import * as core from "@actions/core";

import { Events, Inputs, Outputs, State } from "./constants";
import * as inputs from "./inputs";
import { IStateProvider } from "./stateProvider";
import * as utils from "./utils/action";
import { restoreCaches, restoreWithKey } from "./utils/restore";

async function restoreImpl(
    stateProvider: IStateProvider
): Promise<string | undefined> {
    try {
        if (!utils.isCacheFeatureAvailable()) {
            core.setOutput(Outputs.CacheHit, false);
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

        const keysRestored = await restoreCaches();

        const primaryKey = inputs.key;
        stateProvider.setState(State.CachePrimaryKey, primaryKey);

        utils.info(`Searching for a cache with the key "${primaryKey}".`);

        const primaryKeyRestore = await utils.getCacheKey({
            primaryKey,
            restoreKeys: [],
            lookupOnly: true
        });

        let keyRestored: string | undefined = undefined;

        if (primaryKeyRestore) {
            const primaryKeyRestored = await restoreWithKey(primaryKeyRestore);
            if (primaryKeyRestored) {
                keysRestored.push(...[primaryKeyRestored]);
                keyRestored = primaryKeyRestored;
            }
        }

        if (!keyRestored) {
            utils.info(
                `
                No cache with the given primary key found.
                Searching for a cache using restore key prefixes:
                
                ${JSON.stringify(inputs.restoreFirstMatchKeys)}
                `
            );

            const firstMatchKeyRestore = await utils.getCacheKey({
                primaryKey: "",
                restoreKeys: inputs.restoreFirstMatchKeys,
                lookupOnly: true
            });

            if (firstMatchKeyRestore) {
                const firstMatchKeyRestored = await restoreWithKey(
                    firstMatchKeyRestore
                );
                if (firstMatchKeyRestored) {
                    keysRestored.push(...[firstMatchKeyRestored]);
                    if (inputs.restoreFirstMatchHit) {
                        keyRestored = firstMatchKeyRestored;
                    }
                }
            }
        }

        if (!keyRestored) {
            if (inputs.failOnCacheMiss) {
                throw new Error(
                    `
                    Exiting as ${Inputs.FailOnCacheMiss} is set. 
                    `
                );
            }
            utils.info(`Cache not found.`);

            core.setOutput(Outputs.CachesRestoredKeys, keysRestored);

            return;
        }

        // Store the matched cache key in states
        stateProvider.setState(State.CacheRestoredKey, keyRestored);

        core.setOutput(Outputs.CacheHit, true);
        core.setOutput(Outputs.CacheRestoredKey, keyRestored);
        core.setOutput(Outputs.CachesRestoredKeys, keysRestored);

        return keyRestored;
    } catch (error: unknown) {
        core.setFailed((error as Error).message);
    }
}

export default restoreImpl;
