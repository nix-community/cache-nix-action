# Cache Nix

A GitHub Action to cache Nix store paths using GitHub Actions cache.

This action is based on [actions/cache](https://github.com/actions/cache).

## What it can do (main things)

* Work on `Linux` and `macOS` runners.
* Cache full Nix store into a single cache.
* Collect garbage in the store before saving.
* Merge caches produced by several jobs.
* Purge old caches by their creation or last access time.
* Can be used instead of `actions/cache` if you set `nix: false` (see [Inputs](#inputs)).

## Approach

1. The [nix-quick-install-action](https://github.com/nixbuild/nix-quick-install-action) action makes `/nix/store` owned by an unpriviliged user.

1. `cache-nix-action` tries to restore caches.

1. Other job steps run.

1. Optionally, `cache-nix-action` purges old caches by `created` or `last_accessed` time.

1. Optionally, `cache-nix-action` collects garbage in the Nix store (see [Garbage Collection](#garbage-collection)).

1. `cache-nix-action` saves a new cache when there's no cache hit after purging old caches.

## Comparison with alternative approaches

See [Caching Approaches](#caching-approaches).

## Limitations

* Always caches `/nix`, `~/.cache/nix`, `~root/.cache/nix` paths as suggested [here](https://github.com/divnix/nix-cache-action/blob/b14ec98ae694c754f57f8619ea21b6ab44ccf6e7/action.yml#L7).
* `GitHub` allows only `10GB` of caches and then removes the least recently used entries (see its [eviction policy](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#usage-limits-and-eviction-policy)). Workarounds:
  * [Purge old caches](#purge-old-caches)
  * [Merge caches](#merge-caches)
* `cache-nix-action` requires `nix-quick-install-action` (see [Approach](#approach)).
* Supports only `Linux` and `macOS` runners.
* Nix store size is limited by a runner storage size ([link](https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners/about-github-hosted-runners#supported-runners-and-hardware-resources)). Workaround:
  * The [jlumbroso/free-disk-space](https://github.com/jlumbroso/free-disk-space) action frees `~30GB` of disk space in several minutes.
* Caches are isolated between refs ([link](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache)). Workaround:
  * Provide caches on the default and base branches (for PRs).
* When restoring, `cache-nix-action` writes cached Nix store paths into a read-only `/nix/store` of a runner.
  Some of these paths may already be present, so the action will show `File exists` errors and a warning that it failed to restore.
  It's OK.
* For `purge: true`, a workflow requires the permission `action: write` and the `token` must have a `repo` scope ([link](https://docs.github.com/en/rest/actions/cache?apiVersion=2022-11-28#delete-github-actions-caches-for-a-repository-using-a-cache-key)).
* Purges caches scoped to the current [GITHUB_REF](https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables).
* Purge time is calculated relative to the start of the `Save` phase of this action.
* Purges caches by keys without considering their versions (see [Cache version](#cache-version)).

## Example steps

* Due to `gc-max-store-size-linux: 1073741824`, Nix store size on `Linux` runners will be reduced to `1GB` before trying to save a new cache.
  * If the store has a larger size, it will be garbage collected to reach the (See [Garbage collection parameters](#garbage-collection-parameters)).
  * The `cache-nix-action` will print the Nix store size in the `Post` phase, so you can choose an optimal store size to avoid garbage collection.
* On `macOS` runners, Nix store won't be garbage collected since `gc-max-store-size-macos` isn't set to a number.
* Before trying to save a new cache, the `cache-nix-action` will search for caches with a key prefix `cache-${{ matrix.os }}-`.
  Among these caches, due to `purge-created: 42` the `cache-nix-action` will delete caches created more than `42` seconds ago.

```yaml
- uses: nixbuild/nix-quick-install-action@v26
  with:
    nix_conf: |
      substituters = https://cache.nixos.org/ https://nix-community.cachix.org
      trusted-public-keys = cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY= nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs=
      keep-outputs = true

- name: Restore and cache Nix store
  uses: nix-community/cache-nix-action@v5
  with:
    primary-key: cache-nix-${{ matrix.os }}-${{ hashFiles('**/*.nix') }}
    restore-prefixes-first-match: cache-nix-${{ matrix.os }}-

    gc-max-store-size-linux: 1073741824
    
    purge: true
    purge-prefixes: cache-${{ matrix.os }}-
    purge-created: 42
```

### Example workflow

See [ci.yaml](.github/workflows/ci.yaml).

## Configuration

See [action.yml](action.yml), [restore/action.yml](restore/action.yml), [save/action.yml](save/action.yml).

### Inputs

<table><tr><th>name</th><th>description</th><th>default</th><th>required</th></tr><tr><td><div><p><code>primary-key</code></p></div></td><td><div><ul><li>When a non-empty string, the action uses this key for restoring and saving a cache.</li><li>Otherwise, the action fails.</li></ul></div></td><td><div/></td><td><div><p><code>true</code></p></div></td></tr><tr><td><div><p><code>restore-prefixes-first-match</code></p></div></td><td><div><ul><li>When a newline-separated non-empty list of non-empty key prefixes, when there's a miss on the <code>primary-key</code>,   the action searches in this list for the first prefix for which there exists a cache   with a matching key and the action tries to restore that cache.</li><li>Otherwise, this input has no effect.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>restore-prefixes-all-matches</code></p></div></td><td><div><ul><li>When a newline-separated non-empty list of non-empty key prefixes, the action tries to restore   all caches whose keys match these prefixes.</li><li>Otherwise, this input has no effect.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>skip-restore-on-hit-primary-key</code></p></div></td><td><div><ul><li>Can have an effect only when <code>restore-prefixes-first-match</code> has no effect.</li><li>When <code>true</code>, when there's a hit on the <code>primary-key</code>, the action doesn't restore caches.</li><li>Otherwise, this input has no effect.</li></ul></div></td><td><div><p><code>false</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>fail-on</code></p></div></td><td><div><ul><li>Input form: <code>&lt;key type&gt;.&lt;result&gt;</code>.</li><li><code>&lt;key type&gt;</code> options: <code>primary-key</code>, <code>first-match</code>.</li><li><code>&lt;result&gt;</code> options: <code>miss</code>, <code>not-restored</code>.</li><li>When the input satisfies the input form, when the event described in the input happens, the action fails.</li><li>Example:<ul><li>Input: <code>primary-key.not-restored</code>.</li><li>Event: a cache could not be restored via the <code>primary-key</code>.</li></ul></li><li>Otherwise, this input has no effect.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>nix</code></p></div></td><td><div><ul><li>When <code>true</code>, the action can do Nix-specific things.</li><li>Otherwise, the action doesn't do them.</li></ul></div></td><td><div><p><code>true</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>save</code></p></div></td><td><div><ul><li>When <code>true</code>, the action can save a cache with the <code>primary-key</code>.</li><li>Otherwise, the action can't save a cache.</li></ul></div></td><td><div><p><code>true</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>paths</code></p></div></td><td><div><ul><li>When <code>nix: true</code>, uses <code>["/nix", "~/.cache/nix", "~root/.cache/nix"]</code> as default paths. Otherwise, uses an empty list as default paths.</li><li>When a newline-separated non-empty list of non-empty path patterns (see <a href="https://github.com/actions/toolkit/tree/main/packages/glob"><code>@actions/glob</code></a> for supported patterns), the action appends it to default paths and uses the resulting list for restoring and saving caches.</li><li>Otherwise, the action uses default paths for restoring and saving caches.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>paths-macos</code></p></div></td><td><div><ul><li>Overrides <code>paths</code>.</li><li>Can have an effect only when on a <code>macOS</code> runner.</li><li>When <code>nix: true</code>, uses <code>["/nix", "~/.cache/nix", "~root/.cache/nix"]</code> as default paths. Otherwise, uses an empty list as default paths.</li><li>When a newline-separated non-empty list of non-empty path patterns (see <a href="https://github.com/actions/toolkit/tree/main/packages/glob"><code>@actions/glob</code></a> for supported patterns), the action appends it to default paths and uses the resulting list for restoring and saving caches.</li><li>Otherwise, the action uses default paths for restoring and saving caches.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>paths-linux</code></p></div></td><td><div><ul><li>Overrides <code>paths</code>.</li><li>Can have an effect only when on a <code>Linux</code> runner.</li><li>When <code>nix: true</code>, uses <code>["/nix", "~/.cache/nix", "~root/.cache/nix"]</code> as default paths. Otherwise, uses an empty list as default paths.</li><li>When a newline-separated non-empty list of non-empty path patterns (see <a href="https://github.com/actions/toolkit/tree/main/packages/glob"><code>@actions/glob</code></a> for supported patterns), the action appends it to default paths and uses the resulting list for restoring and saving caches.</li><li>Otherwise, the action uses default paths for restoring and saving caches.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>gc-max-store-size</code></p></div></td><td><div><ul><li>Can have an effect only when <code>nix: true</code>, <code>save: true</code>.</li><li>When a number, the action collects garbage until Nix store size (in bytes) is at most this number just before the action tries to save a new cache.</li><li>Otherwise, this input has no effect.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>gc-max-store-size-macos</code></p></div></td><td><div><ul><li>Can have an effect only when <code>nix: true</code>, <code>save: true</code>.</li><li>Overrides <code>gc-max-store-size</code>.</li><li>Can have an effect only when on a <code>macOS</code> runner.</li><li>When a number, the action collects garbage until Nix store size (in bytes) is at most this number just before the action tries to save a new cache.</li><li>Otherwise, this input has no effect.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>gc-max-store-size-linux</code></p></div></td><td><div><ul><li>Can have an effect only when <code>nix: true</code>, <code>save: true</code>.</li><li>Overrides <code>gc-max-store-size</code>.</li><li>Can have an effect only when on a <code>Linux</code> runner.</li><li>When a number, the action collects garbage until Nix store size (in bytes) is at most this number just before the action tries to save a new cache.</li><li>Otherwise, this input has no effect.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>purge</code></p></div></td><td><div><ul><li>When <code>true</code>, the action purges (possibly zero) caches.</li><li>Otherwise, this input has no effect.</li></ul></div></td><td><div><p><code>false</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>purge-overwrite</code></p></div></td><td><div><ul><li>Can have an effect only when <code>purge: true</code>.</li><li>When <code>always</code>, the action always purges cache with the <code>primary-key</code>.</li><li>When <code>never</code>, the action never purges cache with the <code>primary-key</code>.</li><li>Otherwise, the action purges old caches using purging criteria.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>purge-prefixes</code></p></div></td><td><div><ul><li>Can have an effect only when <code>purge: true</code>.</li><li>When a newline-separated non-empty list of non-empty cache key prefixes, the action collects all cache keys that match these prefixes.</li><li>Otherwise, this input has no effect.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>purge-last-accessed</code></p></div></td><td><div><ul><li>Can have an effect only when <code>purge: true</code>.</li><li>When a number, the action selects for purging caches last accessed more than this number of seconds ago relative to the start of the Save phase.</li><li>Otherwise, this input has no effect.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>purge-created</code></p></div></td><td><div><ul><li>Can have an effect only when <code>purge: true</code>.</li><li>When a number, the action selects for purging caches created more than this number of seconds ago relative to the start of the Save phase.</li><li>Otherwise, this input has no effect.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>upload-chunk-size</code></p></div></td><td><div><ul><li>When a number, the action uses it as the chunk size (in bytes) to split up large files during upload.</li><li>Otherwise, the action uses the default value <code>33554432</code> (32MB).</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>token</code></p></div></td><td><div><p>The action uses it to communicate with GitHub API.</p></div></td><td><div><p><code>${{ github.token }}</code></p></div></td><td><div><p><code>false</code></p></div></td></tr></table>

### Outputs

<table><tr><th>name</th><th>description</th></tr><tr><td><div><p><code>primary-key</code></p></div></td><td><div><ul><li>A string.</li><li>The <code>primary-key</code>.</li></ul></div></td></tr><tr><td><div><p><code>hit</code></p></div></td><td><div><ul><li>A boolean value.</li><li><code>true</code> when <code>hit-primary-key</code> is <code>true</code> or <code>hit-first-match</code> is <code>true</code>.</li><li><code>false</code> otherwise.</li></ul></div></td></tr><tr><td><div><p><code>hit-primary-key</code></p></div></td><td><div><ul><li>A boolean value.</li><li><code>true</code> when there was a hit on the <code>primary-key</code>.</li><li><code>false</code> otherwise.</li></ul></div></td></tr><tr><td><div><p><code>hit-first-match</code></p></div></td><td><div><ul><li>A boolean value.</li><li><code>true</code> when there was a hit on a key matching <code>restore-prefixes-first-match</code>.</li><li><code>false</code> otherwise.</li></ul></div></td></tr><tr><td><div><p><code>restored-key</code></p></div></td><td><div><ul><li>A string.</li><li>The key of a cache restored via the <code>primary-key</code> or via the <code>restore-prefixes-first-match</code>.</li><li>An empty string otherwise.</li></ul></div></td></tr><tr><td><div><p><code>restored-keys</code></p></div></td><td><div><ul><li>A possibly empty array of strings (JSON).</li><li>Keys of restored caches.</li><li>Example: <code>["key1", "key2"]</code>.</li></ul></div></td></tr></table>

### Troubleshooting

* Use [action-tmate](https://github.com/mxschmitt/action-tmate) to debug on a runner via SSH.

### Garbage collection parameters

On `Linux` runners, when `gc-linux` is `true`, when a cache size is greater than `gc-max-cache-size-linux`, this action will run `nix store gc --max R` before saving a cache.
Here, `R` is `max(0, S - gc-max-store-size-linux)`, where `S` is the current store size.
Respective conditions hold for `macOS` runners.

There are alternative approaches to garbage collection (see [Garbage collection](#garbage-collection)).

### Purge old caches

The `cache-nix-action` allows to delete old caches after saving a new cache (see `purge-*` inputs in [Inputs](#inputs) and `compare-run-times` in [Example workflow](#example-workflow)).

The [purge-cache](https://github.com/MyAlbum/purge-cache) action allows to remove caches based on their `last accessed` or `created` time without branch limitations.

Alternatively, you can use the [GitHub Actions Cache API](https://docs.github.com/en/rest/actions/cache).

### Merge caches

`GitHub` evicts least recently used caches when their total size exceeds `10GB` (see [Limitations](#limitations)).

If you have multiple similar caches produced on runners with **the same OS** (`Linux` or `macOS`), you can merge them into a single cache and store just it to save space.

In short:

1. Matrix jobs produce similar individual caches.
1. The next job restores all of these individual caches, saves a common cache, and purges individual caches.
1. On subsequent runs, matrix jobs use the common cache.

See the `make-similar-caches` and `merge-similar-caches` jobs in the [example workflow](#example-workflow).

**Pros**: if `N` individual caches are very similar, a common cache will take approximately `N` times less space.
**Cons**: if caches aren't very similar, run time may increase due to a bigger common cache.

## Caching approaches

Discussed in more details [here](https://github.com/DeterminateSystems/magic-nix-cache-action/issues/16) and [here](https://github.com/nixbuild/nix-quick-install-action/issues/33).

Caching approaches work at different "distances" from `/nix/store` of GitHub Actions runner.
These distances affect the restore and save speed.

### GitHub Actions

* [DeterminateSystems/magic-nix-cache-action](https://github.com/DeterminateSystems/magic-nix-cache-action)
* [nix-community/cache-nix-action](https://github.com/nix-community/cache-nix-action)

#### cache-nix-action

**Pros**:

* Free.
* Uses `GitHub Actions Cache` and works fast.
* Easy to set up.
* Allows to save a store of at most a given size (see [Garbage collection parameters](#garbage-collection-parameters)).
* Allows to save outputs from garbage collection (see [Garbage collection](#garbage-collection)).
* When there's a cache hit, restoring from a GitHub Actions cache can be faster than downloading multiple paths from binary caches.
  * You can compare run times of jobs with and without store caching in [Actions](https://github.com/nix-community/cache-nix-action/actions/workflows/ci.yaml).
        * Open a run and click on the time under `Total duration`.

**Cons**: see [Limitations](#limitations)

#### magic-nix-cache-action

**Pros** ([link](https://github.com/DeterminateSystems/magic-nix-cache#why-use-the-magic-nix-cache)):

* Free.
* Uses `GitHub Actions Cache` and works fast.
* Easy to set up.
* Restores and saves paths selectively.

**Cons**:

* Collects telemetry ([link](https://github.com/DeterminateSystems/magic-nix-cache))
* May trigger rate limit errors ([link](https://github.com/DeterminateSystems/magic-nix-cache#usage-notes)).
* Follows the GitHub Actions Cache semantics ([link](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache)).
  * Caches are isolated between branches ([link](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache)).
* Saves a cache for each path in a store and quickly litters `Caches`.

#### actions/cache

If used with [nix-quick-install-action](https://github.com/nixbuild/nix-quick-install-action), it's similar to the [cache-nix-action](#cache-nix-action).

If used with [install-nix-action](https://github.com/cachix/install-nix-action) and a [chroot local store](https://nixos.org/manual/nix/unstable/command-ref/new-cli/nix3-help-stores.html#local-store):

**Pros**:

* Quick restore and save `/tmp/nix`.

**Cons**:

* Slow [nix copy](https://nixos.org/manual/nix/unstable/command-ref/new-cli/nix3-copy.html) from `/tmp/nix` to `/nix/store`.

If used with [install-nix-action](https://github.com/cachix/install-nix-action) and this [trick](https://github.com/cachix/install-nix-action/issues/56#issuecomment-1030697681), it's similar to the [cache-nix-action](#cache-nix-action), but slower ([link](https://github.com/ryantm/nix-installer-action-benchmark)).

### Hosted binary caches

See [binary cache](https://nixos.org/manual/nix/unstable/glossary.html#gloss-binary-cache), [HTTP Binary Cache Store](https://nixos.org/manual/nix/unstable/command-ref/new-cli/nix3-help-stores.html#http-binary-cache-store).

* [cachix](https://www.cachix.org/)
* [attic](https://github.com/zhaofengli/attic)

**Pros**:

* Restore and save paths selectively.
* Provide least recently used garbage collection strategies ([cachix](https://docs.cachix.org/garbage-collection?highlight=garbage), [attic](https://github.com/zhaofengli/attic#goals)).
* Don't cache paths available from the NixOS cache ([cachix](https://docs.cachix.org/garbage-collection?highlight=upstream)).
* Allow to share paths between projects ([cachix](https://docs.cachix.org/getting-started#using-binaries-with-nix)).

**Cons**:

* Have limited free storage ([cachix](https://www.cachix.org/pricing) gives 5GB for open-source projects).
* Need good bandwidth for receiving and pushing paths over the Internet.
* Can be down.

## Garbage collection

When restoring a Nix store from a cache, the store may contain old unnecessary paths.
These paths should be removed sometimes to limit cache size and ensure the fastest restore/save steps.

### Garbage collection approach 1

Produce a cache once, use it multiple times. Don't collect garbage.

Advantages:

* Unnecessary paths are saved to a cache only during a new save.

Disadvantages:

* Unnecessary paths can accumulate between new saves.
  * A job at the firs run produces a path `A` and saves a cache.
  * The job at the second run restores the cache, produces a path `B`, and saves a cache. The cache has both `A` and `B`.
  * etc.

### Garbage collection approach 2

Collect garbage before saving a cache.

Advantages:

* Automatically keep cache at a minimal/limited size

Disadvantages:

* No standard way to gc only old paths.

### Save a path from garbage collection

* Use `nix profile install` to save installables from garbage collection.
  * Get store paths of `inputs` via `nix flake archive` (see [comment](https://github.com/NixOS/nix/issues/4250#issuecomment-1146878407)).
  * Get outputs via `nix flake show --json | jq  '.packages."x86_64-linux"|keys[]'| xargs -I {}` on `x86_64-linux` (see this [issue](https://github.com/NixOS/nix/issues/7165)).
* Keep inputs (see this [issue](https://github.com/NixOS/nix/issues/4250) and this [issue](https://github.com/NixOS/nix/issues/6895)).
* Start [direnv](https://github.com/nix-community/nix-direnv) in background.

### Garbage collection approaches

* Use [nix-heuristic-gc](https://github.com/risicle/nix-heuristic-gc) for cache eviction via `atime`.
* gc via gc roots [nix-cache-cut](https://github.com/astro/nix-cache-cut).
* gc based on time [cache-gc](https://github.com/lheckemann/cache-gc).

## Contribute

* Improve README.
* Report errors, suggest improvements in issues.
* Upgrade code.
  * Read about [JavaScript actions](https://docs.github.com/en/actions/creating-actions/about-custom-actions?learn=create_actions&learnProduct=actions#javascript-actions)
  * See main files:
    * [restoreImpl.ts](./src/restoreImpl.ts)
    * [saveImpl.ts](./src/saveImpl.ts)
* Upgrade docs.
  * Edit [action.nix](./action.nix).
  * Update `action.yml`-s and `README.md`-s:

    ```console
    nix run .#write
    ```

* Update [actions-toolkit](./actions-toolkit). It was added via `git subtree`. See [tutorial](https://www.atlassian.com/git/tutorials/git-subtree).

# Cache action

## !!! This documentation was inherited from actions/cache and may be partially irrelevant to cache-nix-action

This action allows caching dependencies and build outputs to improve workflow execution time.

>Two other actions are available in addition to the primary `cache` action:
>
>* [Restore action](./restore/README.md)
>* [Save action](./save/README.md)

[![Tests](https://github.com/actions/cache/actions/workflows/workflow.yml/badge.svg)](https://github.com/actions/cache/actions/workflows/workflow.yml)

## Documentation

See ["Caching dependencies to speed up workflows"](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows).

## What's New

### v3

* Added support for caching in GHES 3.5+.
* Fixed download issue for files > 2GB during restore.
* Updated the minimum runner version support from node 12 -> node 16.
* Fixed avoiding empty cache save when no files are available for caching.
* Fixed tar creation error while trying to create tar with path as `~/` home folder on `ubuntu-latest`.
* Fixed zstd failing on amazon linux 2.0 runners.
* Fixed cache not working with github workspace directory or current directory.
* Fixed the download stuck problem by introducing a timeout of 1 hour for cache downloads.
* Fix zstd not working for windows on gnu tar in issues.
* Allowing users to provide a custom timeout as input for aborting download of a cache segment using an environment variable `SEGMENT_DOWNLOAD_TIMEOUT_MINS`. Default is 10 minutes.
* New actions are available for granular control over caches - [restore](restore/action.yml) and [save](save/action.yml).
* Added option to fail job on cache miss. See [Exit workflow on cache miss](./restore/README.md#exit-workflow-on-cache-miss) for more info.
* Fix zstd not being used after zstd version upgrade to 1.5.4 on hosted runners
* Added option to lookup cache without downloading it.
* Reduced segment size to 128MB and segment timeout to 10 minutes to fail fast in case the cache download is stuck.

See the [v2 README.md](https://github.com/actions/cache/blob/v2/README.md) for older updates.

## Usage

### Pre-requisites

Create a workflow `.yml` file in your repository's `.github/workflows` directory. An [example workflow](#example-cache-workflow) is available below. For more information, see the GitHub Help Documentation for [Creating a workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

If you are using this inside a container, a POSIX-compliant `tar` needs to be included and accessible from the execution path.

If you are using a `self-hosted` Windows runner, `GNU tar` and `zstd` are required for [Cross-OS caching](https://github.com/actions/cache/blob/main/tips-and-workarounds.md#cross-os-cache) to work. They are also recommended to be installed in general so the performance is on par with `hosted` Windows runners.

#### Environment Variables

* `SEGMENT_DOWNLOAD_TIMEOUT_MINS` - Segment download timeout (in minutes, default `10`) to abort download of the segment if not completed in the defined number of minutes. [Read more](https://github.com/actions/cache/blob/main/tips-and-workarounds.md#cache-segment-restore-timeout)

### Cache scopes

The cache is scoped to the key, [version](#cache-version), and branch. The default branch cache is available to other branches.

See [Matching a cache key](https://help.github.com/en/actions/configuring-and-managing-workflows/caching-dependencies-to-speed-up-workflows#matching-a-cache-key) for more info.

### Example cache workflow

#### Restoring and saving cache using a single action

```yaml
name: Caching Primes

on: push

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Cache Primes
      id: cache-primes
      uses: actions/cache@v3
      with:
        path: prime-numbers
        key: ${{ runner.os }}-primes

    - name: Generate Prime Numbers
      if: steps.cache-primes.outputs.cache-hit != 'true'
      run: /generate-primes.sh -d prime-numbers

    - name: Use Prime Numbers
      run: /primes.sh -d prime-numbers
```

The `cache` action provides a `cache-hit` output which is set to `true` when the cache is restored using the primary `key` and `false` when the cache is restored using `restore-keys` or no cache is restored.

#### Using a combination of restore and save actions

```yaml
name: Caching Primes

on: push

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Restore cached Primes
      id: cache-primes-restore
      uses: actions/cache/restore@v3
      with:
        path: |
          path/to/dependencies
          some/other/dependencies
        key: ${{ runner.os }}-primes
    .
    . //intermediate workflow steps
    .
    - name: Save Primes
      id: cache-primes-save
      uses: actions/cache/save@v3
      with:
        path: |
          path/to/dependencies
          some/other/dependencies
        key: ${{ steps.cache-primes-restore.outputs.cache-primary-key }}
```

> **Note**
> You must use the `cache` or `restore` action in your workflow before you need to use the files that might be restored from the cache. If the provided `key` matches an existing cache, a new cache is not created and if the provided `key` doesn't match an existing cache, a new cache is automatically created provided the job completes successfully.

## Caching Strategies

With the introduction of the `restore` and `save` actions, a lot of caching use cases can now be achieved. Please see the [caching strategies](./caching-strategies.md) document for understanding how you can use the actions strategically to achieve the desired goal.

## Implementation Examples

Every programming language and framework has its own way of caching.

See [Examples](examples.md) for a list of `actions/cache` implementations for use with:

* [C# - NuGet](./examples.md#c---nuget)
* [Clojure - Lein Deps](./examples.md#clojure---lein-deps)
* [D - DUB](./examples.md#d---dub)
* [Deno](./examples.md#deno)
* [Elixir - Mix](./examples.md#elixir---mix)
* [Go - Modules](./examples.md#go---modules)
* [Haskell - Cabal](./examples.md#haskell---cabal)
* [Haskell - Stack](./examples.md#haskell---stack)
* [Java - Gradle](./examples.md#java---gradle)
* [Java - Maven](./examples.md#java---maven)
* [Node - npm](./examples.md#node---npm)
* [Node - Lerna](./examples.md#node---lerna)
* [Node - Yarn](./examples.md#node---yarn)
* [OCaml/Reason - esy](./examples.md#ocamlreason---esy)
* [PHP - Composer](./examples.md#php---composer)
* [Python - pip](./examples.md#python---pip)
* [Python - pipenv](./examples.md#python---pipenv)
* [R - renv](./examples.md#r---renv)
* [Ruby - Bundler](./examples.md#ruby---bundler)
* [Rust - Cargo](./examples.md#rust---cargo)
* [Scala - SBT](./examples.md#scala---sbt)
* [Swift, Objective-C - Carthage](./examples.md#swift-objective-c---carthage)
* [Swift, Objective-C - CocoaPods](./examples.md#swift-objective-c---cocoapods)
* [Swift - Swift Package Manager](./examples.md#swift---swift-package-manager)
* [Swift - Mint](./examples.md#swift---mint)

## Creating a cache key

A cache key can include any of the contexts, functions, literals, and operators supported by GitHub Actions.

For example, using the [`hashFiles`](https://docs.github.com/en/actions/learn-github-actions/expressions#hashfiles) function allows you to create a new cache when dependencies change.

```yaml
  - uses: actions/cache@v3
    with:
      path: |
        path/to/dependencies
        some/other/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```

Additionally, you can use arbitrary command output in a cache key, such as a date or software version:

```yaml
  # http://man7.org/linux/man-pages/man1/date.1.html
  - name: Get Date
    id: get-date
    run: |
      echo "date=$(/bin/date -u "+%Y%m%d")" >> $GITHUB_OUTPUT
    shell: bash

  - uses: actions/cache@v3
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ steps.get-date.outputs.date }}-${{ hashFiles('**/lockfiles') }}
```

See [Using contexts to create cache keys](https://help.github.com/en/actions/configuring-and-managing-workflows/caching-dependencies-to-speed-up-workflows#using-contexts-to-create-cache-keys)

## Cache Limits

A repository can have up to 10GB of caches. Once the 10GB limit is reached, older caches will be evicted based on when the cache was last accessed.  Caches that are not accessed within the last week will also be evicted.

## Skipping steps based on cache-hit

Using the `cache-hit` output, subsequent steps (such as install or build) can be skipped when a cache hit occurs on the key.  It is recommended to install missing/updated dependencies in case of a partial key match when the key is dependent on the `hash` of the package file.

Example:

```yaml
steps:
  - uses: actions/checkout@v3

  - uses: actions/cache@v3
    id: cache
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}

  - name: Install Dependencies
    if: steps.cache.outputs.cache-hit != 'true'
    run: /install.sh
```

> **Note** The `id` defined in `actions/cache` must match the `id` in the `if` statement (i.e. `steps.[ID].outputs.cache-hit`)

## Cache Version

Cache version is a hash [generated](https://github.com/actions/toolkit/blob/500d0b42fee2552ae9eeb5933091fe2fbf14e72d/packages/cache/src/internal/cacheHttpClient.ts#L73-L90) for a combination of compression tool used (Gzip, Zstd, etc. based on the runner OS) and the `path` of directories being cached. If two caches have different versions, they are identified as unique caches while matching. This, for example, means that a cache created on a `windows-latest` runner can't be restored on `ubuntu-latest` as cache `Version`s are different.

> Pro tip: The [list caches](https://docs.github.com/en/rest/actions/cache#list-github-actions-caches-for-a-repository) API can be used to get the version of a cache. This can be helpful to troubleshoot cache miss due to version.

<details>
  <summary>Example</summary>
The workflow will create 3 unique caches with same keys. Ubuntu and windows runners will use different compression technique and hence create two different caches. And `build-linux` will create two different caches as the `paths` are different.

```yaml
jobs:
  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Cache Primes
        id: cache-primes
        uses: actions/cache@v3
        with:
          path: prime-numbers
          key: primes

      - name: Generate Prime Numbers
        if: steps.cache-primes.outputs.cache-hit != 'true'
        run: ./generate-primes.sh -d prime-numbers

      - name: Cache Numbers
        id: cache-numbers
        uses: actions/cache@v3
        with:
          path: numbers
          key: primes

      - name: Generate Numbers
        if: steps.cache-numbers.outputs.cache-hit != 'true'
        run: ./generate-primes.sh -d numbers

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3

      - name: Cache Primes
        id: cache-primes
        uses: actions/cache@v3
        with:
          path: prime-numbers
          key: primes

      - name: Generate Prime Numbers
        if: steps.cache-primes.outputs.cache-hit != 'true'
        run: ./generate-primes -d prime-numbers
```

</details>

## Known practices and workarounds

There are a number of community practices/workarounds to fulfill specific requirements. You may choose to use them if they suit your use case. Note these are not necessarily the only solution or even a recommended solution.

* [Cache segment restore timeout](./tips-and-workarounds.md#cache-segment-restore-timeout)
* [Update a cache](./tips-and-workarounds.md#update-a-cache)
* [Use cache across feature branches](./tips-and-workarounds.md#use-cache-across-feature-branches)
* [Force deletion of caches overriding default cache eviction policy](./tips-and-workarounds.md#force-deletion-of-caches-overriding-default-cache-eviction-policy)

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
