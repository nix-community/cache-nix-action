export enum Inputs {
    Key = "key", // Input for cache, restore, save action

    Paths = "paths", // Input for cache, save, restore actions
    PathsMacos = "paths-macos", // Input for cache, save, restore actions
    PathsLinux = "paths-linux", // Input for cache, save, restore actions

    RestoreFirstMatchKeys = "restore-first-match-keys", // Input for cache, restore actions
    RestoreFirstMatchHit = "restore-first-match-hit", // Input for cache, restore actions
    RestoreAllMatchesKeys = "restore-all-matches-keys", // Input for cache, restore actions

    GCMaxStoreSize = "gc-max-store-size",
    GCMaxStoreSizeMacos = "gc-max-store-size-macos", // Input for cache, save actions
    GCMaxStoreSizeLinux = "gc-max-store-size-linux", // Input for cache, save actions

    Purge = "purge", // Input for cache, save actions
    PurgeOverwrite = "purge-overwrite", // Input for cache, save actions
    PurgeKeys = "purge-keys", // Input for cache, save actions
    PurgeAccessedMaxAge = "purge-accessed-max-age", // Input for cache, save actions
    PurgeCreatedMaxAge = "purge-created-max-age", // Input for cache, save actions

    UploadChunkSize = "upload-chunk-size", // Input for cache, save actions
    FailOnCacheMiss = "fail-on-cache-miss", // Input for cache, restore actions
    LookupOnlyOnKeyHit = "lookup-only-on-key-hit", // Input for cache, restore, save actions
    Token = "token" // Input for cache, save actions
}

export enum Outputs {
    CacheHit = "cache-hit", // Output from cache, restore actions
    CachePrimaryKey = "cache-primary-key", // Output from cache, restore actions
    CacheRestoredKey = "cache-restored-key", // Output from cache, restore actions
    CachesRestoredKeys = "caches-restored-keys" // Output from cache, restore actions
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
