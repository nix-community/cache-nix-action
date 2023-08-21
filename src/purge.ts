import * as core from "@actions/core";
import * as github from "@actions/github";

function setFailedWrongValue(input: string, value: string) {
    core.setFailed(`Wrong value for the input '${input}': ${value}`);
}

enum Inputs {
    Debug = "debug",
    Token = "token",
    MaxAge = "purge-max-age",
    Accessed = "purge-by-accessed-time",
    Created = "purge-by-created-time"
}

export async function purgeCaches() {
    const debug = core.getInput(Inputs.Debug, { required: false }) === "true";
    const maxAge = core.getInput(Inputs.MaxAge, { required: true });
    const maxDate = new Date(Date.now() - Number.parseInt(maxAge) * 1000);
    if (maxDate === null) {
        setFailedWrongValue(Inputs.MaxAge, maxAge);
    }
    const accessed =
        core.getInput(Inputs.Accessed, { required: false }) === "true";
    const created =
        core.getInput(Inputs.Created, { required: false }) === "true";
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

    for (let i = 1; i <= 100; i += 1) {
        const { data: cachesRequest } =
            await octokit.rest.actions.getActionsCacheList({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                per_page: 100,
                page: i
            });

        if (cachesRequest.actions_caches.length == 0) {
            break;
        }

        results.push(...cachesRequest.actions_caches);
    }

    if (debug) {
        console.log(`Found ${results.length} caches`);
    }

    results.forEach(async cache => {
        if (
            cache.last_accessed_at !== undefined &&
            cache.created_at !== undefined &&
            cache.id !== undefined
        ) {
            const accessedAt = new Date(cache.last_accessed_at);
            const createdAt = new Date(cache.created_at);
            const accessedCondition = accessed && accessedAt < maxDate;
            const createdCondition = created && createdAt < maxDate;
            if (accessedCondition || createdCondition) {
                if (debug) {
                    if (accessedCondition) {
                        console.log(
                            `Deleting cache ${cache.key}, last accessed at ${accessedAt} before ${maxDate}`
                        );
                    }
                    if (createdCondition) {
                        console.log(
                            `Deleting cache ${cache.key}, created at ${createdAt} before ${maxDate}`
                        );
                    }
                }

                try {
                    await octokit.rest.actions.deleteActionsCacheById({
                        per_page: 100,
                        owner: github.context.repo.owner,
                        repo: github.context.repo.repo,
                        cache_id: cache.id
                    });
                } catch (error) {
                    console.log(
                        `Failed to delete cache ${cache.key};\n\n${error}`
                    );
                }
            } else if (debug) {
                if (accessed) {
                    console.log(
                        `Skipping cache ${cache.key}, last accessed at ${accessedAt} after ${maxDate}`
                    );
                }
                if (created) {
                    console.log(
                        `Skipping cache ${cache.key}, created at ${createdAt} after ${maxDate}`
                    );
                }
            }
        }
    });
}
