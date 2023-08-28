import * as core from "@actions/core";
import * as github from "@actions/github";

import { Inputs } from "./constants";
import * as utils from "./utils/actionUtils";

function setFailedWrongValue(input: string, value: string) {
    core.setFailed(`Wrong value for the input '${input}': ${value}`);
}

async function purgeByTime(
    useAccessedTime: boolean,
    keys: string[],
    lookupOnly: boolean,
    time: number
): Promise<[string]> {
    const verb = useAccessedTime ? "last accessed" : "created";

    const inputMaxAge = useAccessedTime
        ? Inputs.PurgeAccessedMaxAge
        : Inputs.PurgeCreatedMaxAge;

    const maxAge = core.getInput(inputMaxAge, { required: false });

    const maxDate = new Date(time - Number.parseInt(maxAge) * 1000);

    if (maxDate === null) {
        setFailedWrongValue(inputMaxAge, maxAge);
    }

    core.info(
        `${
            lookupOnly ? "Purging" : "Searching for"
        } caches with keys ${JSON.stringify(keys)} ${verb} before ${maxDate}`
    );

    const token = core.getInput(Inputs.Token, { required: false });

    const results = await utils.getCachesByKeys(token, keys);

    core.info(
        `Found ${results.length} cache(s)\n\n${JSON.stringify(results)}\n\n`
    );

    if (lookupOnly) {
        return new Promise(() => results);
    }

    const octokit = github.getOctokit(token);

    results.forEach(async cache => {
        const at = useAccessedTime ? cache.last_accessed_at : cache.created_at;
        if (at !== undefined && cache.id !== undefined) {
            const atDate = new Date(at);
            if (atDate < maxDate) {
                core.info(
                    `Deleting cache with key '${cache.key}' ${verb} at ${at}`
                );

                try {
                    await octokit.rest.actions.deleteActionsCacheById({
                        per_page: 100,
                        owner: github.context.repo.owner,
                        repo: github.context.repo.repo,
                        cache_id: cache.id
                    });
                } catch (error) {
                    core.info(
                        `Failed to delete cache ${cache.key}\n\n${error}`
                    );
                }
            } else {
                core.info(`Skipping cache ${cache.key}, ${verb} at ${atDate}`);
            }
        }
    });

    return new Promise(() => []);
}

async function purge(
    key: string,
    lookupOnly: boolean,
    time: number
): Promise<[string]> {
    const accessed =
        core.getInput(Inputs.PurgeAccessed, { required: false }) === "true";

    const created =
        core.getInput(Inputs.PurgeCreated, { required: false }) === "true";

    let purgeKeys = utils.getInputAsArray(Inputs.RestoreKeys);

    if (purgeKeys.length == 0) {
        purgeKeys.push(...[key]);
    }

    purgeKeys = purgeKeys.filter(key => key.trim().length > 0);

    const results: string[] = [];

    if (accessed || created) {
        if (accessed) {
            results.push(
                ...(await purgeByTime(true, purgeKeys, lookupOnly, time))
            );
        }
        if (created) {
            results.push(
                ...(await purgeByTime(false, purgeKeys, lookupOnly, time))
            );
        }
    } else {
        core.warning("Either `accessed` or `created` input should be `true`.");
    }

    return new Promise(() => results);
}

export async function purgeCaches(
    key: string,
    lookupOnly: boolean,
    time: number
) {
    const purgeEnabled = utils.getInputAsBool(Inputs.Purge);

    const results: string[] = [];

    if (purgeEnabled) {
        results.push(...(await purge(key, lookupOnly, time)));
    }

    return results;
}
