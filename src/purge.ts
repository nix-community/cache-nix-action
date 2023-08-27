import * as core from "@actions/core";
import * as github from "@actions/github";

import { Inputs } from "./constants";
import * as utils from "./utils/actionUtils";

function setFailedWrongValue(input: string, value: string) {
    core.setFailed(`Wrong value for the input '${input}': ${value}`);
}

async function purgeByTime(useAccessedTime: boolean, keys: string[]) {
    const verb = useAccessedTime ? "last accessed" : "created";

    const inputMaxAge = useAccessedTime
        ? Inputs.PurgeAccessedMaxAge
        : Inputs.PurgeCreatedMaxAge;

    const maxAge = core.getInput(inputMaxAge, { required: false });

    const maxDate = new Date(Date.now() - Number.parseInt(maxAge) * 1000);

    if (maxDate === null) {
        setFailedWrongValue(inputMaxAge, maxAge);
    }

    core.info(`Purging caches with keys ${keys} ${verb} before ${maxDate}`);

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

    for (let i = 0; i <= keys.length; i += 1) {
        const key = keys[i];
        for (let j = 1; j <= 500; j += 1) {
            const { data: cachesRequest } =
                await octokit.rest.actions.getActionsCacheList({
                    owner: github.context.repo.owner,
                    repo: github.context.repo.repo,
                    key,
                    per_page: 100,
                    page: j,
                    ref: github.context.ref
                });

            if (cachesRequest.actions_caches.length == 0) {
                break;
            }

            results.push(...cachesRequest.actions_caches);
        }
    }

    core.info(`Found ${results.length} cache(s)`);

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
}

function purgeByKey(keys: string[]) {
    core.info(`Purging caches with keys ${keys}`);

    const token = core.getInput(Inputs.Token, { required: false });
    const octokit = github.getOctokit(token);

    keys.forEach(
        async key =>
            await octokit.rest.actions.deleteActionsCacheByKey({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                key,
                ref: github.context.ref
            })
    );
}

async function purge(key: string) {
    const accessed =
        core.getInput(Inputs.PurgeAccessed, { required: false }) === "true";

    const created =
        core.getInput(Inputs.PurgeCreated, { required: false }) === "true";

    let purgeKeys = utils.getInputAsArray(Inputs.RestoreKeys);

    if (purgeKeys.length == 0) {
        purgeKeys.push(...[key]);
    }

    purgeKeys = purgeKeys.filter(key => key.trim().length > 0)

    if (accessed || created) {
        if (accessed) {
            await purgeByTime(true, purgeKeys);
        }
        if (created) {
            await purgeByTime(false, purgeKeys);
        }
    } else {
        purgeByKey(purgeKeys);
    }
}

export async function purgeCaches(key: string) {
    const purgeEnabled = utils.getInputAsBool(Inputs.Purge);
    if (purgeEnabled) {
        await purge(key);
    }
}
