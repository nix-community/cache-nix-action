export enum Inputs {
    Key = "key", // Input for cache, restore, save action

    Paths = "paths", // Input for cache, save, restore actions
    PathsMacos = "paths-macos", // Input for cache, save, restore actions
    PathsLinux = "paths-linux", // Input for cache, save, restore actions

    RestoreFirstMatchKeys = "restore-first-match-keys", // Input for cache, restore actions
    RestoreAllMatchesKeys = "restore-all-matches-keys", // Input for cache, restore actions

    GCMaxStoreSize = "gc-max-store-size",
    GCMaxStoreSizeMacos = "gc-max-store-size-macos", // Input for cache, save actions
    GCMaxStoreSizeLinux = "gc-max-store-size-linux", // Input for cache, save actions

    Purge = "purge", // Input for cache, save actions
    PurgeOverwrite = "purge-overwrite", // Input for cache, save actions
    PurgeKeys = "purge-keys", // Input for cache, save actions
    PurgeLastAccessedMaxAge = "purge-last-accessed-max-age", // Input for cache, save actions
    PurgeCreatedMaxAge = "purge-created-max-age", // Input for cache, save actions

    UploadChunkSize = "upload-chunk-size", // Input for cache, save actions
    FailOnCacheMiss = "fail-on-cache-miss", // Input for cache, restore actions
    LookupOnlyOnHitKey = "lookup-only-on-hit-key", // Input for cache, restore, save actions
    Token = "token" // Input for cache, save actions
}

export enum Outputs {
    Key = "key",

    Hit = "hit", // Output from cache, restore actions
    HitKey = "hit-key", // Output from cache, restore actions
    HitFirstMatch = "hit-first-match", // Output from cache, restore actions

    RestoredKey = "restored-key", // Output from cache, restore actions
    RestoredKeys = "restored-keys" // Output from cache, restore actions
}

export enum State {
    CachePrimaryKey = "CACHE_PRIMARY_KEY",
    CacheRestoredKey = "CACHE_RESTORED_KEY"
}

export enum Events {
    Key = "GITHUB_EVENT_NAME",
    Push = "push",
    PullRequest = "pull_request"
}

export const RefKey = "GITHUB_REF";
