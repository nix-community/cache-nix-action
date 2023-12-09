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
        core.setOutput(Outputs.Hit, false);
        core.setOutput(Outputs.HitKey, false);
        core.setOutput(Outputs.HitFirstMatch, false);
        core.setOutput(Outputs.RestoredKey, false);
        core.setOutput(Outputs.RestoredKeys, []);

        if (!utils.isCacheFeatureAvailable()) {
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

        const restoredKeys = await restoreCaches();

        const primaryKey = inputs.key;
        stateProvider.setState(State.CachePrimaryKey, primaryKey);

        utils.info(`Searching for a cache with the key "${primaryKey}".`);

        let restoredKey: string | undefined;

        {
            const foundKey = await utils.getCacheKey({
                primaryKey,
                restoreKeys: [],
                lookupOnly: true
            });
            if (foundKey) {
                restoredKey = await restoreWithKey(primaryKey);
                if (restoredKey) {
                    restoredKeys.push(...[restoredKey]);
                    core.setOutput(Outputs.HitKey, true);
                }
            }
        }

        if (!restoredKey) {
            utils.info(
                `
                No cache with the given primary key found.
                Searching for a cache using restore key prefixes:
                
                ${JSON.stringify(inputs.restoreFirstMatchKeys)}
                `
            );

            const foundKey = await utils.getCacheKey({
                primaryKey: "",
                restoreKeys: inputs.restoreFirstMatchKeys,
                lookupOnly: true
            });

            if (foundKey) {
                restoredKey = await restoreWithKey(foundKey);
                if (restoredKey) {
                    restoredKeys.push(...[restoredKey]);
                    core.setOutput(Outputs.HitFirstMatch, true);
                }
            }
        }

        if (!restoredKey) {
            if (inputs.failOnCacheMiss) {
                throw new Error(`Exiting as ${Inputs.FailOnCacheMiss} is set.`);
            }
            utils.warning(`Cache not found.`);

            core.setOutput(Outputs.RestoredKeys, restoredKeys);

            return;
        }

        // Store the matched cache key in states
        stateProvider.setState(State.CacheRestoredKey, restoredKey);

        core.setOutput(Outputs.Hit, true);
        core.setOutput(Outputs.RestoredKey, restoredKey);
        core.setOutput(Outputs.RestoredKeys, restoredKeys);

        return restoredKey;
    } catch (error: unknown) {
        core.setFailed((error as Error).message);
    }
}

export default restoreImpl;
