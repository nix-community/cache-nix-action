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
    lookupOnly: boolean
): Promise<[string]> {
    const verb = useAccessedTime ? "last accessed" : "created";

    const inputMaxAge = useAccessedTime
        ? Inputs.PurgeAccessedMaxAge
        : Inputs.PurgeCreatedMaxAge;

    const maxAge = core.getInput(inputMaxAge, { required: false });

    const maxDate = new Date(Date.now() - Number.parseInt(maxAge) * 1000);

    if (maxDate === null) {
        setFailedWrongValue(inputMaxAge, maxAge);
    }

    core.info(
        `Purging caches with keys ${JSON.stringify(
            keys
        )} ${verb} before ${maxDate}`
    );

    const token = core.getInput(Inputs.Token, { required: false });
    const octokit = github.getOctokit(token);

    interface Cache {
        id?: number | undefined;
        ref?: string | undefined;
        key?: string | undefined;
        version?: string | undefined;
        last_accessed_at?: string | undefined;
        created_at?: string | undefined;
        size_in_bytes?: number | undefined;
    }

    const results: Cache[] = [];

    for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        for (let page = 1; page <= 500; page += 1) {
            const { data: cachesRequest } =
                await octokit.rest.actions.getActionsCacheList({
                    owner: github.context.repo.owner,
                    repo: github.context.repo.repo,
                    key,
                    per_page: 100,
                    page,
                    ref: github.context.ref
                });

            if (cachesRequest.actions_caches.length == 0) {
                break;
            }

            results.push(...cachesRequest.actions_caches);
        }
    }

    core.info(`Found ${results.length} cache(s)`);

    if (lookupOnly) {
        return new Promise(() => results);
    }

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

async function purge(key: string, lookupOnly: boolean): Promise<[string]> {
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
            results.push(...(await purgeByTime(true, purgeKeys, lookupOnly)));
        }
        if (created) {
            results.push(...(await purgeByTime(false, purgeKeys, lookupOnly)));
        }
    } else {
        core.warning("Either `accessed` or `created` input should be `true`.");
    }

    return new Promise(() => results);
}

export async function purgeCaches(key: string, lookupOnly: boolean) {
    const purgeEnabled = utils.getInputAsBool(Inputs.Purge);

    const results: string[] = [];

    if (purgeEnabled) {
        results.push(...(await purge(key, lookupOnly)));
    }

    return results;
}
