import * as actionsCache from "@actions/cache";
import * as actionsCacheUtils from "@actions/cache/cacheUtils";
import * as buildjetCache from "@buildjet/cache";
import * as buildjetCacheUtils from "@buildjet/cache/cacheUtils";
import * as warpbuildCache from "@warpbuild/cache";
import * as warpbuildCacheUtils from "@warpbuild/cache/cacheUtils";

import { Backend, backend } from "../inputs";

export const cache:
    | typeof actionsCache
    | typeof buildjetCache
    | typeof warpbuildCache =
    backend == Backend.Actions
        ? actionsCache
        : backend == Backend.WarpBuild
          ? warpbuildCache
          : buildjetCache;
export const cacheUtils:
    | typeof actionsCacheUtils
    | typeof buildjetCacheUtils
    | typeof warpbuildCacheUtils =
    backend == Backend.Actions
        ? actionsCacheUtils
        : backend == Backend.WarpBuild
          ? warpbuildCacheUtils
          : buildjetCacheUtils;
