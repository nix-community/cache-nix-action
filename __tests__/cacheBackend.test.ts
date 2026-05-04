import { Inputs } from "../src/constants";

const actionsSaveCache = jest.fn();
const actionsRestoreCache = jest.fn();
const buildjetSaveCache = jest.fn();
const buildjetRestoreCache = jest.fn();
const warpbuildSaveCache = jest.fn();
const warpbuildRestoreCache = jest.fn();

jest.mock(
    "@actions/cache",
    () => ({
        saveCache: actionsSaveCache,
        restoreCache: actionsRestoreCache
    }),
    { virtual: true }
);
jest.mock("@actions/cache/cacheUtils", () => ({}), { virtual: true });
jest.mock(
    "@buildjet/cache",
    () => ({
        saveCache: buildjetSaveCache,
        restoreCache: buildjetRestoreCache
    }),
    { virtual: true }
);
jest.mock("@buildjet/cache/cacheUtils", () => ({}), { virtual: true });
jest.mock(
    "@warpbuild/cache",
    () => ({
        saveCache: warpbuildSaveCache,
        restoreCache: warpbuildRestoreCache
    }),
    { virtual: true }
);
jest.mock("@warpbuild/cache/cacheUtils", () => ({}), { virtual: true });

function envName(input: string): string {
    return `INPUT_${input.replace(/ /g, "_").toUpperCase()}`;
}

function loadCacheBackend(
    backend: string
): typeof import("../src/utils/cacheBackend") {
    let mod!: typeof import("../src/utils/cacheBackend");
    jest.isolateModules(() => {
        process.env[envName(Inputs.PrimaryKey)] = "test-key";
        process.env[envName(Inputs.Token)] = "test-token";
        process.env[envName(Inputs.Backend)] = backend;
        mod = require("../src/utils/cacheBackend");
    });
    return mod;
}

afterEach(() => {
    jest.clearAllMocks();
    delete process.env[envName(Inputs.PrimaryKey)];
    delete process.env[envName(Inputs.Token)];
    delete process.env[envName(Inputs.Backend)];
});

describe("cacheBackend warpbuild adapter", () => {
    test("saveCache forwards paths, key and enableCrossOsArchive; drops uploadChunkSize and tarCommandModifiers", async () => {
        warpbuildSaveCache.mockResolvedValue("some-cache-key");
        const { cache } = loadCacheBackend("warpbuild");

        const result = await cache.saveCache(
            ["/nix"],
            "primary-key",
            { uploadChunkSize: 1024 },
            true,
            // @ts-expect-error - adapter ignores tarCommandModifiers, value shape doesn't matter
            { createArgs: ["--exclude=foo"] }
        );

        expect(warpbuildSaveCache).toHaveBeenCalledWith(
            ["/nix"],
            "primary-key",
            true,
            false
        );
        expect(result).toBe(1);
    });

    test("saveCache returns -1 when warp-cache returns an empty key (reserve/upload failure)", async () => {
        warpbuildSaveCache.mockResolvedValue("");
        const { cache } = loadCacheBackend("warpbuild");

        const result = await cache.saveCache(["/nix"], "primary-key");

        expect(result).toBe(-1);
    });

    test("saveCache defaults enableCrossOsArchive to false when caller omits it", async () => {
        warpbuildSaveCache.mockResolvedValue("ok");
        const { cache } = loadCacheBackend("warpbuild");

        await cache.saveCache(["/nix"], "primary-key");

        expect(warpbuildSaveCache).toHaveBeenCalledWith(
            ["/nix"],
            "primary-key",
            false,
            false
        );
    });

    test("restoreCache forwards paths, keys, options and enableCrossOsArchive; drops tarCommandModifiers", async () => {
        warpbuildRestoreCache.mockResolvedValue("matched-key");
        const { cache } = loadCacheBackend("warpbuild");

        const result = await cache.restoreCache(
            ["/nix"],
            "primary-key",
            ["fallback-1", "fallback-2"],
            { lookupOnly: true },
            true,
            // @ts-expect-error - adapter ignores tarCommandModifiers
            { extractArgs: ["--strip=1"] }
        );

        expect(warpbuildRestoreCache).toHaveBeenCalledWith(
            ["/nix"],
            "primary-key",
            ["fallback-1", "fallback-2"],
            { lookupOnly: true },
            true,
            false
        );
        expect(result).toBe("matched-key");
    });

    test("restoreCache propagates undefined when warp-cache misses", async () => {
        warpbuildRestoreCache.mockResolvedValue(undefined);
        const { cache } = loadCacheBackend("warpbuild");

        const result = await cache.restoreCache(["/nix"], "primary-key");

        expect(result).toBeUndefined();
    });
});

describe("cacheBackend selection", () => {
    test("selects @actions/cache saveCache when backend input is unset", async () => {
        actionsSaveCache.mockResolvedValue(42);
        const { cache } = loadCacheBackend("");
        await cache.saveCache(["/nix"], "k");
        expect(actionsSaveCache).toHaveBeenCalled();
        expect(buildjetSaveCache).not.toHaveBeenCalled();
        expect(warpbuildSaveCache).not.toHaveBeenCalled();
    });

    test("selects @actions/cache when backend is 'actions'", async () => {
        actionsSaveCache.mockResolvedValue(42);
        const { cache } = loadCacheBackend("actions");
        await cache.saveCache(["/nix"], "k");
        expect(actionsSaveCache).toHaveBeenCalled();
        expect(buildjetSaveCache).not.toHaveBeenCalled();
        expect(warpbuildSaveCache).not.toHaveBeenCalled();
    });

    test("selects @buildjet/cache when backend is 'buildjet'", async () => {
        buildjetSaveCache.mockResolvedValue(42);
        const { cache } = loadCacheBackend("buildjet");
        await cache.saveCache(["/nix"], "k");
        expect(buildjetSaveCache).toHaveBeenCalled();
        expect(actionsSaveCache).not.toHaveBeenCalled();
        expect(warpbuildSaveCache).not.toHaveBeenCalled();
    });

    test("warpbuild backend routes through the adapter to @warpbuild/cache", async () => {
        warpbuildSaveCache.mockResolvedValue("ok");
        const { cache } = loadCacheBackend("warpbuild");
        await cache.saveCache(["/nix"], "k");
        expect(warpbuildSaveCache).toHaveBeenCalled();
        expect(actionsSaveCache).not.toHaveBeenCalled();
        expect(buildjetSaveCache).not.toHaveBeenCalled();
    });
});
