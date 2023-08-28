export enum Inputs {
    Key = "key", // Input for cache, restore, save action
    Path = "path", // Input for cache, restore, save action
    RestoreKeys = "restore-keys", // Input for cache, restore action
    UploadChunkSize = "upload-chunk-size", // Input for cache, save action
    EnableCrossOsArchive = "enableCrossOsArchive", // Input for cache, restore, save action
    FailOnCacheMiss = "fail-on-cache-miss", // Input for cache, restore action
    LookupOnly = "lookup-only", // Input for cache, restore action

    RestoreKeyHit = "restore-key-hit",

    ExtraRestoreKeys = "extra-restore-keys", // Input for cache, restore action

    GCMacos = "gc-macos", // Input for cache, save action
    GCMaxStoreSizeMacos = "gc-max-store-size-macos", // Input for cache, save action
    GCLinux = "gc-linux", // Input for cache, save action
    GCMaxStoreSizeLinux = "gc-max-store-size-linux", // Input for cache, save action

    Token = "token", // Input for cache, save action

    Purge = "purge", // Input for cache, save action
    PurgeKeys = "purge-keys", // Input for cache, save action
    PurgeAccessed = "purge-accessed", // Input for cache, save action
    PurgeAccessedMaxAge = "purge-accessed-max-age", // Input for cache, save action
    PurgeCreated = "purge-created", // Input for cache, save action
    PurgeCreatedMaxAge = "purge-created-max-age" // Input for cache, save action
}

export enum Outputs {
    CacheHit = "cache-hit", // Output from cache, restore action
    CachePrimaryKey = "cache-primary-key", // Output from restore action
    CacheMatchedKey = "cache-matched-key" // Output from restore action
}

export enum State {
    CachePrimaryKey = "CACHE_KEY",
    CacheMatchedKey = "CACHE_RESULT"
}

export enum Events {
    Key = "GITHUB_EVENT_NAME",
    Push = "push",
    PullRequest = "pull_request"
}

export const RefKey = "GITHUB_REF";
