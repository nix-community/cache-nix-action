import * as actionsCache from "@actions/cache";
import * as actionsCacheUtils from "@actions/cache/cacheUtils";
import * as buildjetCache from "@buildjet/cache";
import * as buildjetCacheUtils from "@buildjet/cache/cacheUtils";

import { Backend, backend } from "../inputs";

export const cache: typeof buildjetCache | typeof actionsCache =
    backend == Backend.BuildJet ? buildjetCache : actionsCache;
export const cacheUtils: typeof buildjetCacheUtils | typeof actionsCacheUtils =
    backend == Backend.BuildJet ? buildjetCacheUtils : actionsCacheUtils;
