# Cache Nix action

A GitHub Action to restore and save (not only) Nix store paths using GitHub Actions cache.

This action is based on [actions/cache](https://github.com/actions/cache).

## What it can

- Restore and save the Nix store on `Linux` and `macOS` runners.
- Restore and save other directories on `Linux`, `macOS`, and `Windows` runners.
- Collect garbage in the Nix store before saving a new cache.
- Merge caches produced by several jobs.
- Purge caches created or last accessed at least the given time ago.

## A typical job

1. The [nix-quick-install-action](https://github.com/nixbuild/nix-quick-install-action) installs Nix and makes `/nix/store` owned by an unpriviliged user.

1. `Restore` phase:

   1. The `cache-nix-action` tries to restore a cache whose key is the same as the primary key.

   1. When it can't restore, the `cache-nix-action` tries to restore a cache whose key matches a prefix in a given list of key prefixes.

   1. The `cache-nix-action` restores all caches whose keys match some of the prefixes in another given list of key prefixes.

1. Other job steps run.

1. `Post Restore` phase:

   1. The `cache-nix-action` purges caches whose keys are the same as the primary key and that were created more than a given time ago.

   1. When there's no cache whose key is the same as the primary key, the `cache-nix-action` collects garbage in the Nix store and saves a new cache.

   1. The `cache-nix-action` purges caches whose keys match some of the given prefixes in a given list of key prefixes and that were created more than a given time ago relative to the start of the `Post Restore` phase.

## Limitations

- Requires `nix-quick-install-action`.
- Supports only `Linux` and `macOS` runners for Nix store caching.
- `GitHub` allows only `10GB` of caches and then removes the least recently used entries (see its [eviction policy](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#usage-limits-and-eviction-policy)). Workarounds:
  - [Purge old caches](#purge-old-caches)
  - [Merge caches](#merge-caches)
- Nix store size is limited by a runner storage size ([link](https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners/about-github-hosted-runners#supported-runners-and-hardware-resources)). Workaround:
  - The [jlumbroso/free-disk-space](https://github.com/jlumbroso/free-disk-space) action frees `~30GB` of disk space in several minutes.
- Caches are isolated for restoring between refs ([link](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache)). Workaround:
  - Provide caches for PRs on the default or base branches.
- For purging, a workflow requires the permission `actions: write` and the `token` must have a `repo` scope ([link](https://docs.github.com/en/rest/actions/cache?apiVersion=2022-11-28#delete-github-actions-caches-for-a-repository-using-a-cache-key)).
- Purges caches scoped to the current [GITHUB_REF](https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables).
- Purges caches by keys without considering caches versions (see [Cache version](#cache-version)).
- Runs `tar ... --skip-old-files ...` to not overwrite existing files when restoring a cache (see [this comment](https://github.com/nix-community/cache-nix-action/issues/9#issuecomment-1871311709)).

## Comparison with alternative approaches

See [Caching Approaches](#caching-approaches).

## Additional actions

- [Restore action](./restore/README.md)
- [Save action](./save/README.md)

## Example steps

```yaml
- uses: nixbuild/nix-quick-install-action@v26

- name: Restore and cache Nix store
  uses: nix-community/cache-nix-action@v5
  with:
    # restore and save a cache using this key
    primary-key: nix-${{ runner.os }}-${{ hashFiles('**/*.nix') }}
    # if there's no cache hit, restore a cache by this prefix
    restore-prefixes-first-match: nix-${{ runner.os }}-
    # collect garbage until Nix store size (in bytes) is at most this number
    # before trying to save a new cache
    gc-max-store-size-linux: 1073741824
    # do purge caches
    purge: true
    # purge all versions of the cache
    purge-prefixes: cache-${{ runner.os }}-
    # created more than this number of seconds ago relative to the start of the `Post Restore` phase
    purge-created: 0
    # except the version with the `primary-key`, if it exists
    purge-primary-key: never
```

- `nix-quick-install-action` loads `nixConfig` from `flake.nix` and writes to [nix.conf](https://nixos.org/manual/nix/unstable/command-ref/conf-file.html) (see [action.yml](https://github.com/nixbuild/nix-quick-install-action/blob/master/action.yml) in `the nix-quick-install` repo).
- Due to `gc-max-store-size-linux: 1073741824`, on `Linux` runners, garbage in the Nix store is collected until store size reaches `1GB` or until there's no garbage to collect.
- Since `gc-max-store-size-macos` isn't set to a number, on `macOS` runners, no garbage is collected in the Nix store.
- The `cache-nix-action` purges caches:
  - (with a key prefix `cache-${{ runner.os }}-`) **AND** (created more than `42` seconds ago **OR** last accessed more than `42` seconds ago).

### Example workflow

See [ci.yaml](.github/workflows/ci.yaml) and its [runs](https://github.com/nix-community/cache-nix-action/actions/workflows/ci.yaml).

## Configuration

See [action.yml](action.yml).

<!-- action-docs-inputs action="action.yml" -->

## Inputs

| name                              | description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | required | default               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------- |
| `primary-key`                     | <ul> <li>When a non-empty string, the action uses this key for restoring and saving a cache.</li> <li>Otherwise, the action fails.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `true`   | `""`                  |
| `restore-prefixes-first-match`    | <ul> <li>When a newline-separated non-empty list of non-empty key prefixes, when there's a miss on the <code>primary-key</code>, the action searches in this list for the first prefix for which there exists a cache with a matching key and the action tries to restore that cache.</li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                | `false`  | `""`                  |
| `restore-prefixes-all-matches`    | <ul> <li>When a newline-separated non-empty list of non-empty key prefixes, the action tries to restore all caches whose keys match these prefixes.</li> <li>Tries caches across all refs to make use of caches created on the current, base, and default branches (see <a href="https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache">docs</a>).</li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                                        | `false`  | `""`                  |
| `skip-restore-on-hit-primary-key` | <ul> <li>Can have an effect only when <code>restore-prefixes-first-match</code> has no effect.</li> <li>When <code>true</code>, when there's a hit on the <code>primary-key</code>, the action doesn't restore caches.</li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `false`  | `false`               |
| `fail-on`                         | <ul> <li>Input form: <code>&lt;key type&gt;.&lt;result&gt;</code>.</li> <li><code>&lt;key type&gt;</code> options: <code>primary-key</code>, <code>first-match</code>.</li> <li><code>&lt;result&gt;</code> options: <code>miss</code>, <code>not-restored</code>.</li> <li>When the input satisfies the input form, when the event described in the input happens, the action fails.</li> <li>Example:<ul> <li>Input: <code>primary-key.not-restored</code>.</li> <li>Event: a cache could not be restored via the <code>primary-key</code>.</li></ul></li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                              | `false`  | `""`                  |
| `nix`                             | <ul> <li>Can have an effect only when the action runs on a <code>Linux</code> or a <code>macOS</code> runner.</li> <li>When <code>true</code>, the action can do Nix-specific things.</li> <li>Otherwise, the action doesn't do them.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `false`  | `true`                |
| `save`                            | <ul> <li>When <code>true</code>, the action can save a cache with the <code>primary-key</code>.</li> <li>Otherwise, the action can't save a cache.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `false`  | `true`                |
| `paths`                           | <ul> <li>When <code>nix: true</code>, the action uses <code>["/nix", "~/.cache/nix", "~root/.cache/nix"]</code> as default paths, as suggested <a href="https://github.com/divnix/nix-cache-action/blob/b14ec98ae694c754f57f8619ea21b6ab44ccf6e7/action.yml#L7">here</a>.</li> <li>Otherwise, the action uses an empty list as default paths.</li> <li>When a newline-separated non-empty list of non-empty path patterns (see <a href="https://github.com/actions/toolkit/tree/main/packages/glob"><code>@actions/glob</code></a> for supported patterns), the action appends it to default paths and uses the resulting list for restoring and saving caches.</li> <li>Otherwise, the action uses default paths for restoring and saving caches.</li> </ul> | `false`  | `""`                  |
| `paths-macos`                     | <ul> <li>Overrides <code>paths</code>.</li> <li>Can have an effect only when the action runs on a <code>macOS</code> runner.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `false`  | `""`                  |
| `paths-linux`                     | <ul> <li>Overrides <code>paths</code>.</li> <li>Can have an effect only when the action runs on a <code>Linux</code> runner.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `false`  | `""`                  |
| `gc-max-store-size`               | <ul> <li>Can have an effect only when <code>nix: true</code>, <code>save: true</code>.</li> <li>When a number, the action collects garbage until Nix store size (in bytes) is at most this number just before the action tries to save a new cache.</li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `false`  | `""`                  |
| `gc-max-store-size-macos`         | <ul> <li>Overrides <code>gc-max-store-size</code>.</li> <li>Can have an effect only when the action runs on a <code>macOS</code> runner.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `false`  | `""`                  |
| `gc-max-store-size-linux`         | <ul> <li>Overrides <code>gc-max-store-size</code>.</li> <li>Can have an effect only when the action runs on a <code>Linux</code> runner.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `false`  | `""`                  |
| `purge`                           | <ul> <li>When <code>true</code>, the action purges (possibly zero) caches.</li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `false`  | `false`               |
| `purge-primary-key`               | <ul> <li>Can have an effect only when <code>purge: true</code>.</li> <li>When <code>always</code>, the action always purges cache with the <code>primary-key</code>.</li> <li>When <code>never</code>, the action never purges cache with the <code>primary-key</code>.</li> <li>Otherwise, this input has no effect..</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                             | `false`  | `""`                  |
| `purge-prefixes`                  | <ul> <li>Can have an effect only when <code>purge: true</code>.</li> <li>When a newline-separated non-empty list of non-empty cache key prefixes, the action selects for purging all caches whose keys match some of these prefixes and that are scoped to the current <a href="https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables">GITHUB_REF</a>.</li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                                                                     | `false`  | `""`                  |
| `purge-last-accessed`             | <ul> <li>Can have an effect only when <code>purge: true</code>.</li> <li>When a number, the action purges selected caches that were last accessed more than this number of seconds ago relative to the start of the <code>Post Restore</code> phase.</li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `false`  | `""`                  |
| `purge-created`                   | <ul> <li>Can have an effect only when <code>purge: true</code>.</li> <li>When a number, the action purges caches created more than this number of seconds ago relative to the start of the <code>Post Restore</code> phase.</li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `false`  | `""`                  |
| `upload-chunk-size`               | <ul> <li>When a number, the action uses it as the chunk size (in bytes) to split up large files during upload.</li> <li>Otherwise, the action uses the default value <code>33554432</code> (32MB).</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `false`  | `""`                  |
| `save-always`                     | <p>Run the post step to save the cache even if another step before fails.</p>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `false`  | `false`               |
| `token`                           | <p>The action uses it to communicate with GitHub API.</p>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `false`  | `${{ github.token }}` |

<!-- action-docs-inputs action="action.yml" -->

<!-- action-docs-outputs action="action.yml" -->

## Outputs

| name              | description                                                                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `primary-key`     | <ul> <li>A string.</li> <li>The <code>primary-key</code>.</li> </ul>                                                                                                                                                |
| `hit`             | <ul> <li>A boolean value.</li> <li><code>true</code> when <code>hit-primary-key</code> is <code>true</code> or <code>hit-first-match</code> is <code>true</code>.</li> <li><code>false</code> otherwise.</li> </ul> |
| `hit-primary-key` | <ul> <li>A boolean value.</li> <li><code>true</code> when there was a hit on the <code>primary-key</code>.</li> <li><code>false</code> otherwise.</li> </ul>                                                        |
| `hit-first-match` | <ul> <li>A boolean value.</li> <li><code>true</code> when there was a hit on a key matching <code>restore-prefixes-first-match</code>.</li> <li><code>false</code> otherwise.</li> </ul>                            |
| `restored-key`    | <ul> <li>A string.</li> <li>The key of a cache restored via the <code>primary-key</code> or via the <code>restore-prefixes-first-match</code>.</li> <li>An empty string otherwise.</li> </ul>                       |
| `restored-keys`   | <ul> <li>A possibly empty array of strings (JSON).</li> <li>Keys of restored caches.</li> <li>Example: <code>["key1", "key2"]</code>.</li> </ul>                                                                    |

<!-- action-docs-outputs action="action.yml" -->

### Troubleshooting

- Use [action-tmate](https://github.com/mxschmitt/action-tmate) to debug on a runner via SSH.

### Garbage collection parameters

On `Linux` runners, when `gc-max-store-size-linux` is set to a number, the `cache-nix-action` will run `nix store gc --max R` before saving a cache.
Here, `R` is `max(0, S - gc-max-store-size-linux)`, where `S` is the current store size.

Respective conditions hold for `macOS` runners.

There are alternative approaches to garbage collection (see [Garbage collection](#garbage-collection)).

### Purge old caches

The `cache-nix-action` allows to delete old caches after saving a new cache (see `purge-*` inputs in [Inputs](#inputs) and the `compare-run-times` job in the [Example workflow](#example-workflow)).

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

- [DeterminateSystems/magic-nix-cache-action](https://github.com/DeterminateSystems/magic-nix-cache-action)
- [nix-community/cache-nix-action](https://github.com/nix-community/cache-nix-action)

#### cache-nix-action

**Pros**:

- Free.
- Easy to set up.
- Uses `GitHub Actions Cache` and works fast.
- Doesn't require repository secrets.
- Allows to save a store of at most a given size (see [Garbage collection parameters](#garbage-collection-parameters)).
- Allows to save outputs from garbage collection (see [Garbage collection](#garbage-collection)).
- When there's a cache hit, restoring from a GitHub Actions cache can be faster than downloading multiple paths from binary caches.
  - You can compare run times of jobs with and without store caching in [Actions](https://github.com/nix-community/cache-nix-action/actions/workflows/ci.yaml).
    - Open a run and click on the time under `Total duration`.

**Cons**: see [Limitations](#limitations)

#### magic-nix-cache-action

**Pros** ([link](https://github.com/DeterminateSystems/magic-nix-cache#why-use-the-magic-nix-cache)):

- Free.
- Easy to set up.
- Uses `GitHub Actions Cache` and works fast.
- Restores and saves paths selectively.

**Cons**:

- Collects telemetry ([link](https://github.com/DeterminateSystems/magic-nix-cache))
- May trigger rate limit errors ([link](https://github.com/DeterminateSystems/magic-nix-cache#usage-notes)).
- Follows the GitHub Actions Cache semantics ([link](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache)).
  - Caches are isolated between branches ([link](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache)).
- Saves a cache for each path in a store and quickly litters `Caches`.

#### actions/cache

If used with [nix-quick-install-action](https://github.com/nixbuild/nix-quick-install-action), it's similar to the [cache-nix-action](#cache-nix-action).

If used with [install-nix-action](https://github.com/cachix/install-nix-action) and a [chroot local store](https://nixos.org/manual/nix/unstable/command-ref/new-cli/nix3-help-stores.html#local-store):

**Pros**:

- Quick restore and save `/tmp/nix`.

**Cons**:

- Slow [nix copy](https://nixos.org/manual/nix/unstable/command-ref/new-cli/nix3-copy.html) from `/tmp/nix` to `/nix/store`.

If used with [install-nix-action](https://github.com/cachix/install-nix-action) and this [trick](https://github.com/cachix/install-nix-action/issues/56#issuecomment-1030697681), it's similar to the [cache-nix-action](#cache-nix-action), but slower ([link](https://github.com/ryantm/nix-installer-action-benchmark)).

### Hosted binary caches

See [binary cache](https://nixos.org/manual/nix/unstable/glossary.html#gloss-binary-cache), [HTTP Binary Cache Store](https://nixos.org/manual/nix/unstable/command-ref/new-cli/nix3-help-stores.html#http-binary-cache-store).

- [cachix](https://www.cachix.org/)
- [attic](https://github.com/zhaofengli/attic)

**Pros**:

- Restore and save paths selectively.
- Provide least recently used garbage collection strategies ([cachix](https://docs.cachix.org/garbage-collection?highlight=garbage), [attic](https://github.com/zhaofengli/attic#goals)).
- Don't cache paths available from the NixOS cache ([cachix](https://docs.cachix.org/garbage-collection?highlight=upstream)).
- Allow to share paths between projects ([cachix](https://docs.cachix.org/getting-started#using-binaries-with-nix)).

**Cons**:

- Have limited free storage ([cachix](https://www.cachix.org/pricing) gives 5GB for open-source projects).
- Need good bandwidth for receiving and pushing paths over the Internet.
- Can be down.

## Garbage collection

When restoring a Nix store from a cache, the store may contain old unnecessary paths.
These paths should be removed sometimes to limit cache size and ensure the fastest restore/save steps.

### Garbage collection approach 1

Produce a cache once, use it multiple times. Don't collect garbage.

Advantages:

- Unnecessary paths are saved to a cache only during a new save.

Disadvantages:

- Unnecessary paths can accumulate between new saves.
  - A job at the firs run produces a path `A` and saves a cache.
  - The job at the second run restores the cache, produces a path `B`, and saves a cache. The cache has both `A` and `B`.
  - etc.

### Garbage collection approach 2

Collect garbage before saving a cache.

Advantages:

- Automatically keep cache at a minimal/limited size

Disadvantages:

- No standard way to gc only old paths.

### Save a path from garbage collection

- Use `nix profile install` to save installables from garbage collection.
  - Get store paths of `inputs` via `nix flake archive` (see [comment](https://github.com/NixOS/nix/issues/4250#issuecomment-1146878407)).
  - Get outputs via `nix flake show --json | jq  '.packages."x86_64-linux"|keys[]'| xargs -I {}` on `x86_64-linux` (see this [issue](https://github.com/NixOS/nix/issues/7165)).
- Keep inputs (see this [issue](https://github.com/NixOS/nix/issues/4250) and this [issue](https://github.com/NixOS/nix/issues/6895)).
- Start [direnv](https://github.com/nix-community/nix-direnv) in background.

### Garbage collection approaches

- Use [nix-heuristic-gc](https://github.com/risicle/nix-heuristic-gc) for cache eviction via `atime`.
- gc via gc roots [nix-cache-cut](https://github.com/astro/nix-cache-cut).
- gc based on time [cache-gc](https://github.com/lheckemann/cache-gc).

## Contribute

- Improve README.
- Report errors, suggest improvements in issues.
- Upgrade code.
  - Read about [JavaScript actions](https://docs.github.com/en/actions/creating-actions/about-custom-actions?learn=create_actions&learnProduct=actions#javascript-actions)
  - See main files:
    - [restoreImpl.ts](./src/restoreImpl.ts)
    - [saveImpl.ts](./src/saveImpl.ts)
- Upgrade docs.

  - Edit [action.nix](./action.nix).
  - Update `action.yml`-s and `README.md`-s:

    ```console
    nix run .#write
    ```

- Update the `actions-toolkit` branch.
- Ask for new releases of `@cache-nix-action/cache` if there are changes on the `actions-toolkit` branch.

# Cache action

[![Tests](https://github.com/actions/cache/actions/workflows/workflow.yml/badge.svg)](https://github.com/actions/cache/actions/workflows/workflow.yml)

## Documentation

See ["Caching dependencies to speed up workflows"](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows).

## What's New

### v4

- Updated to node 20
- Added a `save-always` flag to save the cache even if a prior step fails

### v3

- Added support for caching in GHES 3.5+.
- Fixed download issue for files > 2GB during restore.
- Updated the minimum runner version support from node 12 -> node 16.
- Fixed avoiding empty cache save when no files are available for caching.
- Fixed tar creation error while trying to create tar with path as `~/` home folder on `ubuntu-latest`.
- Fixed zstd failing on amazon linux 2.0 runners.
- Fixed cache not working with github workspace directory or current directory.
- Fixed the download stuck problem by introducing a timeout of 1 hour for cache downloads.
- Fix zstd not working for windows on gnu tar in issues.
- Allowing users to provide a custom timeout as input for aborting download of a cache segment using an environment variable `SEGMENT_DOWNLOAD_TIMEOUT_MINS`. Default is 10 minutes.
- New actions are available for granular control over caches - [restore](restore/action.yml) and [save](save/action.yml).
- Added option to fail job on cache miss. See [Exit workflow on cache miss](./restore/README.md#exit-workflow-on-cache-miss) for more info.
- Fix zstd not being used after zstd version upgrade to 1.5.4 on hosted runners
- Added option to lookup cache without downloading it.
- Reduced segment size to 128MB and segment timeout to 10 minutes to fail fast in case the cache download is stuck.

See the [v2 README.md](https://github.com/actions/cache/blob/v2/README.md) for older updates.

## Usage

### Pre-requisites

Create a workflow `.yml` file in your repository's `.github/workflows` directory. An [example workflow](#example-cache-workflow) is available below. For more information, see the GitHub Help Documentation for [Creating a workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

If you are using this inside a container, a POSIX-compliant `tar` needs to be included and accessible from the execution path.

If you are using a `self-hosted` Windows runner, `GNU tar` and `zstd` are required for [Cross-OS caching](https://github.com/actions/cache/blob/main/tips-and-workarounds.md#cross-os-cache) to work. They are also recommended to be installed in general so the performance is on par with `hosted` Windows runners.

#### Environment Variables

- `SEGMENT_DOWNLOAD_TIMEOUT_MINS` - Segment download timeout (in minutes, default `10`) to abort download of the segment if not completed in the defined number of minutes. [Read more](https://github.com/actions/cache/blob/main/tips-and-workarounds.md#cache-segment-restore-timeout)

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
      - uses: actions/checkout@v4

      - name: Cache Primes
        id: cache-primes
        uses: actions/cache@v4
        with:
          primary-key: ${{ runner.os }}-primes
          paths: prime-numbers

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
      - uses: actions/checkout@v4

      - name: Restore cached Primes
        id: cache-primes-restore
        uses: nix-community/cache-nix-action/restore@v5
        with:
          primary-key: ${{ runner.os }}-primes
          paths: |
            path/to/dependencies
            some/other/dependencies

      # other steps

      - name: Save Primes
        id: cache-primes-save
        uses: nix-community/cache-nix-action/save@v5
        with:
          primary-key: ${{ steps.cache-primes-restore.outputs.cache-primary-key }}
          paths: |
            path/to/dependencies
            some/other/dependencies
```

> **Note**
> You must use the `cache` or `restore` action in your workflow before you need to use the files that might be restored from the cache. If the provided `key` matches an existing cache, a new cache is not created and if the provided `key` doesn't match an existing cache, a new cache is automatically created provided the job completes successfully.

## Caching Strategies

With the introduction of the `restore` and `save` actions, a lot of caching use cases can now be achieved. Please see the [caching strategies](./caching-strategies.md) document for understanding how you can use the actions strategically to achieve the desired goal.

## Implementation Examples

Every programming language and framework has its own way of caching.

See [Examples](examples.md) for a list of `actions/cache` implementations for use with:

- [C# - NuGet](./examples.md#c---nuget)
- [Clojure - Lein Deps](./examples.md#clojure---lein-deps)
- [D - DUB](./examples.md#d---dub)
- [Deno](./examples.md#deno)
- [Elixir - Mix](./examples.md#elixir---mix)
- [Go - Modules](./examples.md#go---modules)
- [Haskell - Cabal](./examples.md#haskell---cabal)
- [Haskell - Stack](./examples.md#haskell---stack)
- [Java - Gradle](./examples.md#java---gradle)
- [Java - Maven](./examples.md#java---maven)
- [Node - npm](./examples.md#node---npm)
- [Node - Lerna](./examples.md#node---lerna)
- [Node - Yarn](./examples.md#node---yarn)
- [OCaml/Reason - esy](./examples.md#ocamlreason---esy)
- [PHP - Composer](./examples.md#php---composer)
- [Python - pip](./examples.md#python---pip)
- [Python - pipenv](./examples.md#python---pipenv)
- [R - renv](./examples.md#r---renv)
- [Ruby - Bundler](./examples.md#ruby---bundler)
- [Rust - Cargo](./examples.md#rust---cargo)
- [Scala - SBT](./examples.md#scala---sbt)
- [Swift, Objective-C - Carthage](./examples.md#swift-objective-c---carthage)
- [Swift, Objective-C - CocoaPods](./examples.md#swift-objective-c---cocoapods)
- [Swift - Swift Package Manager](./examples.md#swift---swift-package-manager)
- [Swift - Mint](./examples.md#swift---mint)

## Creating a cache key

A cache key can include any of the contexts, functions, literals, and operators supported by GitHub Actions.

For example, using the [`hashFiles`](https://docs.github.com/en/actions/learn-github-actions/expressions#hashfiles) function allows you to create a new cache when dependencies change.

```yaml
- uses: nix-community/cache-nix-action@v5
  with:
    primary-key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
    paths: |
      path/to/dependencies
      some/other/dependencies
```

Additionally, you can use arbitrary command output in a cache key, such as a date or software version:

```yaml
# http://man7.org/linux/man-pages/man1/date.1.html
- name: Get Date
  id: get-date
  run: echo "date=$(/bin/date -u "+%Y%m%d")" >> $GITHUB_OUTPUT
  shell: bash

- uses: nix-community/cache-nix-action@v5
  with:
    primary-key: ${{ runner.os }}-${{ steps.get-date.outputs.date }}-${{ hashFiles('**/lockfiles') }}
    paths: path/to/dependencies
```

See [Using contexts to create cache keys](https://help.github.com/en/actions/configuring-and-managing-workflows/caching-dependencies-to-speed-up-workflows#using-contexts-to-create-cache-keys)

## Cache Limits

A repository can have up to 10GB of caches. Once the 10GB limit is reached, older caches will be evicted based on when the cache was last accessed. Caches that are not accessed within the last week will also be evicted.

## Skipping steps based on cache hit

Using the `hit-primary-key` output, subsequent steps (such as install or build) can be skipped when a cache hit occurs on the primary key. It is recommended to install missing/updated dependencies in case of a partial key match when the key is dependent on the `hash` of the package file.

Example:

```yaml
steps:
  - uses: actions/checkout@v4

  - uses: nix-community/cache-nix-action@v5
    id: cache
    with:
      primary-key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
      path: path/to/dependencies

  - name: Install Dependencies
    if: steps.cache.outputs.hit-primary-key != true
    run: /install.sh
```

> **Note** The `id` defined in `nix-community/cache-nix-action` must match the `[id]` in the `if` statement (i.e. `steps.[id].outputs.hit-primary-key`)

## Cache Version

Cache version is a hash [generated](https://github.com/actions/toolkit/blob/500d0b42fee2552ae9eeb5933091fe2fbf14e72d/packages/cache/src/internal/cacheHttpClient.ts#L73-L90) for a combination of compression tool used (Gzip, Zstd, etc. based on the runner OS) and the `path` of directories being cached. If two caches have different versions, they are identified as unique caches while matching. This, for example, means that a cache created on a `windows-latest` runner can't be restored on `ubuntu-latest` as cache `Version`s are different.

> Pro tip: The [list caches](https://docs.github.com/en/rest/actions/cache#list-github-actions-caches-for-a-repository) API can be used to get the version of a cache. This can be helpful to troubleshoot cache miss due to version.

<details>
  <summary>Example</summary>

The workflow will create 3 unique caches with same keys. `Linux` and `Windows` runners will use different compression technique and hence create two different caches. And `build-linux` will create two different caches as the `paths` are different.

```yaml
jobs:
  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Cache Primes
        id: cache-primes
        uses: nix-community/cache-nix-action@v5
        with:
          primary-key: primes
          paths: prime-numbers

      - name: Generate Prime Numbers
        if: steps.cache-primes.outputs.cache-hit != 'true'
        run: ./generate-primes.sh -d prime-numbers

      - name: Cache Numbers
        id: cache-numbers
        uses: nix-community/cache-nix-action@v5
        with:
          primary-key: primes
          paths: numbers

      - name: Generate Numbers
        if: steps.cache-numbers.outputs.cache-hit != 'true'
        run: ./generate-primes.sh -d numbers

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Cache Primes
        id: cache-primes
        uses: nix-community/cache-nix-action@v5
        with:
          primary-key: primes
          paths: prime-numbers

      - name: Generate Prime Numbers
        if: steps.cache-primes.outputs.cache-hit != 'true'
        run: ./generate-primes -d prime-numbers
```

</details>

## Known practices and workarounds

There are a number of community practices/workarounds to fulfill specific requirements. You may choose to use them if they suit your use case. Note these are not necessarily the only solution or even a recommended solution.

## Cache segment restore timeout

A cache gets downloaded in multiple segments of fixed sizes (`1GB` for a `32-bit` runner and `2GB` for a `64-bit` runner). Sometimes, a segment download gets stuck which causes the workflow job to be stuck forever and fail. Version `v3.0.8` of `actions/cache` introduces a segment download timeout. The segment download timeout will allow the segment download to get aborted and hence allow the job to proceed with a cache miss.

Default value of this timeout is 10 minutes and can be customized by specifying an [environment variable](https://docs.github.com/en/actions/learn-github-actions/environment-variables) named `SEGMENT_DOWNLOAD_TIMEOUT_MINS` with timeout value in minutes.

## Update a cache

A cache today is immutable and cannot be updated. But some use cases require the cache to be saved even though there was a hit during the `Restore phase`. To do so, always purge old versions of that cache:

```yaml
- name: update cache on every commit
  uses: actions/cache@v4
  with:
    primary-key: primes-${{ runner.os }}
    paths: prime-numbers
    purge: true
    purge-primary-key: always
```

Please note that this will create a new cache on every run and hence will consume the cache [quota](./README.md#cache-limits).

## Use cache across feature branches

Reusing cache across feature branches is not allowed today to provide cache [isolation](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache). However if both feature branches are from the default branch, a good way to achieve this is to ensure that the default branch has a cache. This cache will then be consumable by both feature branches.

## Force deletion of caches overriding default cache eviction policy

Caches have [branch scope restriction](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache) in place. This means that if caches for a specific branch are using a lot of storage quota, it may result into more frequently used caches from `default` branch getting thrashed. For example, if there are many pull requests happening on a repo and are creating caches, these cannot be used in default branch scope but will still occupy a lot of space till they get cleaned up by [eviction policy](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#usage-limits-and-eviction-policy). But sometime we want to clean them up on a faster cadence so as to ensure default branch is not thrashing. In order to achieve this, [gh-actions-cache cli](https://github.com/actions/gh-actions-cache/) can be used to delete caches for specific branches.

This workflow uses `gh-actions-cache` to delete all the caches created by a branch.

<details>
  <summary>Example</summary>

```yaml
name: cleanup caches by a branch
on:
  pull_request:
    types:
      - closed
  workflow_dispatch:

jobs:
  cleanup:
    runs-on: ubuntu-latest
    permissions:
      # `actions:write` permission is required to delete caches
      #   See also: https://docs.github.com/en/rest/actions/cache?apiVersion=2022-11-28#delete-a-github-actions-cache-for-a-repository-using-a-cache-id
      actions: write
      contents: read
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Cleanup
        run: |
          gh extension install actions/gh-actions-cache

          REPO=${{ github.repository }}
          BRANCH=refs/pull/${{ github.event.pull_request.number }}/merge

          echo "Fetching list of cache key"
          cacheKeysForPR=$(gh actions-cache list -R $REPO -B $BRANCH | cut -f 1 )

          ## Setting this to not fail the workflow while deleting cache keys. 
          set +e
          echo "Deleting caches..."
          for cacheKey in $cacheKeysForPR
          do
              gh actions-cache delete $cacheKey -R $REPO -B $BRANCH --confirm
          done
          echo "Done"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

</details>

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
