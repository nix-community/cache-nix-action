export enum Inputs {
    PrimaryKey = "primary-key", // Input for cache, restore, save action

    RestorePrefixesFirstMatch = "restore-prefixes-first-match", // Input for cache, restore actions
    RestorePrefixesAllMatches = "restore-prefixes-all-matches", // Input for cache, restore actions

    LookupOnly = "lookup-only", // Input for cache, restore actions

    FailOn = "fail-on", // Input for cache, restore actions

    Nix = "nix", // Input for cache, save, restore actions

    Save = "save", // Input for cache, save actions

    Paths = "paths", // Input for cache, save, restore actions
    PathsMacos = "paths-macos", // Input for cache, save, restore actions
    PathsLinux = "paths-linux", // Input for cache, save, restore actions

    GCMaxStoreSize = "gc-max-store-size", // Input for cache, save actions
    GCMaxStoreSizeMacos = "gc-max-store-size-macos", // Input for cache, save actions
    GCMaxStoreSizeLinux = "gc-max-store-size-linux", // Input for cache, save actions

    Purge = "purge", // Input for cache, save actions
    PurgePrimaryKey = "purge-primary-key", // Input for cache, save actions
    PurgePrefixes = "purge-prefixes", // Input for cache, save actions
    PurgeLastAccessed = "purge-last-accessed", // Input for cache, save actions
    PurgeCreated = "purge-created", // Input for cache, save actions

    UploadChunkSize = "upload-chunk-size", // Input for cache, save actions
    Token = "token", // Input for cache, save actions

    Backend = "backend" // Input for cache, save, restore actions
}

export enum Outputs {
    PrimaryKey = "primary-key",

    Hit = "hit", // Output from cache, restore actions
    HitPrimaryKey = "hit-primary-key", // Output from cache, restore actions
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

export const dbStandardPath = "/nix/var/nix/db/db.sqlite";
