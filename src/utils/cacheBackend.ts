import * as actionsCache from "@actions/cache";
import * as actionsCacheUtils from "@actions/cache/cacheUtils";
import * as buildjetCache from "@buildjet/cache";
import * as buildjetCacheUtils from "@buildjet/cache/cacheUtils";
import * as warpbuildCache from "@warpbuild/cache";
import * as warpbuildCacheUtils from "@warpbuild/cache/cacheUtils";

import { Backend, backend } from "../inputs";

// warp-cache exposes a different shape than @actions/cache and @buildjet/cache
// (no UploadOptions/TarCommandModifiers, returns a string key instead of a
// numeric id). Wrap it so all backends share one call signature.
const warpbuildAdapter: Pick<
    typeof actionsCache,
    "saveCache" | "restoreCache"
> = {
    saveCache: async (paths, key, _options, enableCrossOsArchive) => {
        const cacheKey = await warpbuildCache.saveCache(
            paths,
            key,
            enableCrossOsArchive ?? false,
            false
        );
        return cacheKey ? 1 : -1;
    },
    restoreCache: (
        paths,
        primaryKey,
        restoreKeys,
        options,
        enableCrossOsArchive
    ) =>
        warpbuildCache.restoreCache(
            paths,
            primaryKey,
            restoreKeys,
            options,
            enableCrossOsArchive ?? false,
            false
        )
};

export const cache: typeof actionsCache =
    backend == Backend.Actions
        ? actionsCache
        : backend == Backend.WarpBuild
          ? { ...actionsCache, ...warpbuildAdapter }
          : (buildjetCache as unknown as typeof actionsCache);

export const cacheUtils: typeof actionsCacheUtils =
    backend == Backend.Actions
        ? actionsCacheUtils
        : backend == Backend.WarpBuild
          ? (warpbuildCacheUtils as unknown as typeof actionsCacheUtils)
          : (buildjetCacheUtils as unknown as typeof actionsCacheUtils);
