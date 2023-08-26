import * as core from "@actions/core";
import * as github from "@actions/github";

import * as utils from "./utils/actionUtils";

function setFailedWrongValue(input: string, value: string) {
    core.setFailed(`Wrong value for the input '${input}': ${value}`);
}

enum Inputs {
    Token = "token",
    PurgeEnabled = "purge",
    PurgeKey = "purge-key",
    Accessed = "purge-accessed",
    AccessedMaxAge = "purge-accessed-max-age",
    Created = "purge-created",
    CreatedMaxAge = "purge-created-max-age"
}

async function purgeByTime(useAccessedTime: boolean, key: string) {
    const verb = useAccessedTime ? "last accessed" : "created";

    const inputMaxAge = useAccessedTime
        ? Inputs.AccessedMaxAge
        : Inputs.CreatedMaxAge;

    const maxAge = core.getInput(inputMaxAge, { required: false });

    const maxDate = new Date(Date.now() - Number.parseInt(maxAge) * 1000);

    if (maxDate === null) {
        setFailedWrongValue(inputMaxAge, maxAge);
    }

    core.info(`Purging caches with key '${key}' ${verb} before ${maxDate}`);

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

    for (let i = 1; i <= 500; i += 1) {
        const { data: cachesRequest } =
            await octokit.rest.actions.getActionsCacheList({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                key,
                per_page: 100,
                page: i
                // ref: github.context.ref
            });

        if (cachesRequest.actions_caches.length == 0) {
            break;
        }

        results.push(...cachesRequest.actions_caches);
    }

    core.info(`Found ${results.length} caches`);

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

async function purgeByKey(key: string) {
    core.info(`Purging caches with key '${key}'`);

    const token = core.getInput(Inputs.Token, { required: false });
    const octokit = github.getOctokit(token);

    await octokit.rest.actions.deleteActionsCacheByKey({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        key,
        ref: github.context.ref
    });
}

async function purge(key: string) {
    const accessed =
        core.getInput(Inputs.Accessed, { required: false }) === "true";

    const created =
        core.getInput(Inputs.Created, { required: false }) === "true";

    let purgeKey = core.getInput(Inputs.PurgeKey, { required: false });

    if (purgeKey.trim().length === 0) {
        purgeKey = key;
    }

    if (accessed || created) {
        if (accessed) {
            await purgeByTime(true, purgeKey);
        }
        if (created) {
            await purgeByTime(false, purgeKey);
        }
    } else {
        await purgeByKey(purgeKey);
    }
}

export async function purgeCaches(key: string) {
    const purgeEnabled = utils.getInputAsBool(Inputs.PurgeEnabled);
    if (purgeEnabled) {
        await purge(key);
    }
}
