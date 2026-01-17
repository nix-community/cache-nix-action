# Cache Nix Store

A GitHub Action to restore and save Nix store paths using GitHub Actions cache.

This action is based on [actions/cache](https://github.com/actions/cache).

## Additional actions

- [Restore action](./restore/README.md)
- [Save action](./save/README.md)

## Features

- Restore and save the Nix store on `Linux` and `macOS` runners.
- Restore and save other directories on `Linux`, `macOS`, and `Windows` runners.
- Collect garbage in the Nix store before saving a new cache.
- Merge caches produced by several jobs.
- Purge caches created or last accessed at least the given time ago.
- Redefine `ACTIONS_CACHE_URL` and `ACTIONS_RESULTS_URL` using `CUSTOM_ACTIONS_CACHE_URL` and `CUSTOM_ACTIONS_RESULTS_URL` environment variables.

## Compatible Nix installers

`cache-nix-action` is compatible with:

- [`nixbuild/nix-quick-install-action`](https://github.com/nixbuild/nix-quick-install-action)
- [`cachix/install-nix-action`](https://github.com/cachix/install-nix-action/)
- [`DeterminateSystems/determinate-nix-action`](https://github.com/DeterminateSystems/determinate-nix-action)

## A typical job

> [!NOTE]
> See all available action inputs in [Inputs](#inputs).

> [!NOTE]
> The action can't restore a cache when there's a mismatch in the [cache version](#cache-version), e.g., when `paths` used to create a cache differ from those specified in the current job run.

1. One of the [compatible actions](#compatible-nix-installers) installs Nix.

1. `Restore` phase:
   1. The `cache-nix-action` tries to restore a cache whose key is the same as the specified one (input: `primary-key`).

   1. When the `cache-nix-action` can't restore, it tries to restore a cache whose key matches a prefix in a given list of key prefixes (input: `restore-prefixes-first-match`).

   1. The `cache-nix-action` restores all caches whose keys match some of the prefixes in another given list of key prefixes (input: `restore-prefixes-all-matches`).

1. Other job steps run.

1. `Post Restore` phase:
   1. The `cache-nix-action` purges caches whose keys are the same as the primary key and that were created or last accessed more than a given time ago (inputs: `purge`, `purge-created`, `purge-last-accessed`, `purge-primary-key`).

   1. When there's no cache whose key is the same as the primary key, the `cache-nix-action` collects garbage in the Nix store and saves a new cache (inputs: `save`, `gc-max-store-size`, `gc-max-store-size-linux`, `gc-max-store-size-macos`).

   1. The `cache-nix-action` purges caches whose keys match some of the given prefixes in a given list of key prefixes and that were created or last accessed more than a given time ago relative to the start of the `Post Restore` phase (inputs: `purge`, `purge-prefixes`, `purge-created`, `purge-last-accessed`, `purge-primary-key`).

## Limitations

### Speed

- The action may slow down your workflow. You should test whether the action is useful in your case.

### Runners

- The action supports only `Linux` and `macOS` GitHub Actions runners for Nix store caching.
- Nix 2.24+ and SQLite 3.37+ must be installed on the runner.

### Restoring files

- By default, the action caches and restores only `/nix` (see [documentation](#inputs) for the `paths` input).
- The action doesn't automatically cache stores specified via the `--store` flag ([link](https://nix.dev/manual/nix/2.33/store/types/local-store.html#local-store)).
- The action removes existing Nix store database files after merging the existing database with the restored one.

  <details><summary>(Click to view details)</summary>
  - The action [checkpoints](https://sqlite.org/pragma.html#pragma_wal_checkpoint) the existing database before restoring a cache.
  - The action merges the existing and restored databases (`/nix/var/nix/db/db.sqlite`) and Nix stores (`/nix/store`) when restoring a cache.
  - Out of all files in `/nix/var`, the action restores only `/nix/var/nix/db/db.sqlite`.
  - The action removes existing `/nix/var/nix/db/db.sqlite-wal` and `/nix/var/nix/db/db.sqlite-shm` (see [WAL-mode File Format](https://sqlite.org/walformat.html)) because they're unnecessary.
  - The action merges the old and new databases when restoring a cache.
  - The action overwrites the old database with the merged database.

  </details>

### Purging existing caches

- The action purges caches scoped to the current [GITHUB_REF](https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables).
- The action purges caches by keys without considering cache versions (see [Cache version](#cache-version)).
- `GitHub` allows only `10GB` of caches and then removes the least recently used entries (see its [eviction policy](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#usage-limits-and-eviction-policy)). Workarounds:
  - [Purge old caches](#purge-old-caches)
  - [Merge caches](#merge-caches)

### Cache size

- The Nix store size is limited by a runner storage size ([link](https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners/about-github-hosted-runners#supported-runners-and-hardware-resources)).

  <details><summary>Workarounds: increase the storage size on the runner (click to view)</summary>
  - Search: <https://github.com/marketplace?query=disk>
  - Ubuntu, macOS, Windows:
    - [hugoalh/disk-space-optimizer-ghaction](https://github.com/hugoalh/disk-space-optimizer-ghaction)
  - Ubuntu, macOS:
    - [`nodejs/node` PR](https://github.com/nodejs/node/pull/54658/files#diff-60e66ca8b630611c89b474be16a0c987928cfce83f77968025815c302ad731fe) ([example](https://github.com/nix-community/cache-nix-action/blob/21c2dba637f3bdce2f39e4b39a383c806e0cce13/.github/workflows/ci.yaml#L357-L368))
  - Ubuntu:
    - [jlumbroso/free-disk-space](https://github.com/jlumbroso/free-disk-space)
    - [wimpysworld/nothing-but-nix](https://github.com/wimpysworld/nothing-but-nix) (see [issue](https://github.com/wimpysworld/nothing-but-nix/issues/33))
    - [endersonmenezes/free-disk-space](https://github.com/endersonmenezes/free-disk-space)
    - [easimon/maximize-build-space](https://github.com/easimon/maximize-build-space)
    - [AdityaGarg8/remove-unwanted-software](https://github.com/AdityaGarg8/remove-unwanted-software),[gmij/max-build-space](https://github.com/gmij/max-build-space)
    - [firus-v/free-disk-space](https://github.com/firus-v/free-disk-space)
    - [coder-xiaomo/free-disk-space](https://github.com/coder-xiaomo/free-disk-space)
    - [data-intuitive/reclaim-the-bytes](https://github.com/data-intuitive/reclaim-the-bytes)
    - [laverdet/remove-bloatware](https://github.com/laverdet/remove-bloatware)
    - [xd009642/ci-hoover](https://github.com/xd009642/ci-hoover)
    - [justinthelaw/maximize-github-runner-space](https://github.com/justinthelaw/maximize-github-runner-space)
  - macOS:
    - [comment](https://github.com/easimon/maximize-build-space/issues/7#issuecomment-1063681606)

  </details>

### Restoring caches

- Caches are isolated for restoring between refs ([link](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache)).
  - Workaround: provide caches for PRs on default or base branches.

### Garbage collection

- Garbage collection by default evicts flake inputs ([issue](https://github.com/NixOS/nix/issues/6895)).
  - Workaround: see [Save Nix store paths from garbage collection](#save-nix-store-paths-from-garbage-collection).

## Comparison with alternative approaches

See [Caching Approaches](#caching-approaches).

## Examples

### Single step for restore and save

> [!NOTE]
> For purging, the workflow or the job must have the [permission](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#permissions) `actions: write`.

> [!NOTE]
> If the `paths` input is specified, the action will be able to restore only caches created with the same `paths`.

```yaml
- uses: nixbuild/nix-quick-install-action@v30
  with:
    nix_conf: |
      keep-env-derivations = true
      keep-outputs = true

- name: Restore and save Nix store
  uses: nix-community/cache-nix-action@v6
  with:
    # restore and save a cache using this key
    primary-key: nix-${{ runner.os }}-${{ hashFiles('**/*.nix', '**/flake.lock') }}
    # if there's no cache hit, restore a cache by this prefix
    restore-prefixes-first-match: nix-${{ runner.os }}-
    # collect garbage until the Nix store size (in bytes) is at most this number
    # before trying to save a new cache
    # 1G = 1073741824
    gc-max-store-size-linux: 1G
    # do purge caches
    purge: true
    # purge all versions of the cache
    purge-prefixes: nix-${{ runner.os }}-
    # created more than this number of seconds ago
    purge-created: 0
    # or last accessed this duration (ISO 8601 duration format)
    # before the start of the `Post Restore and save Nix store` phase
    purge-last-accessed: P1DT12H
    # except any version with the key that is the same as the `primary-key`
    purge-primary-key: never
```

- `nix-quick-install-action` writes the supplied [nix_conf](https://github.com/nixbuild/nix-quick-install-action/blob/8505cd40ae3d4791ca658f2697c5767212e5ce71/action.yml#L19) to [nix.conf](https://nix.dev/manual/nix/2.33/command-ref/conf-file.html) (see [action.yml](https://github.com/nixbuild/nix-quick-install-action/blob/8505cd40ae3d4791ca658f2697c5767212e5ce71/action.yml#L63), [script](https://github.com/nixbuild/nix-quick-install-action/blob/8505cd40ae3d4791ca658f2697c5767212e5ce71/nix-quick-install.sh#L99)).
- `nix-quick-install-action` enables [flakes](https://nixos.wiki/wiki/Flakes) and accepts `nixConfig` from `flake.nix` (see [script](https://github.com/nixbuild/nix-quick-install-action/blob/8505cd40ae3d4791ca658f2697c5767212e5ce71/nix-quick-install.sh#L113)).
- Due to `gc-max-store-size-linux: 1G`, on `Linux` runners, garbage in the Nix store is collected until the store size reaches `1GB` or until there's no garbage to collect.
- Since `gc-max-store-size-macos` isn't set to a number, on `macOS` runners, no garbage is collected in the Nix store.
- At the end of the job, and before trying to save a new cache, the `cache-nix-action` purges caches:
  - (with the key prefix `nix-${{ runner.os }}-`) **AND** (created more than `0` seconds ago **OR** last accessed more than `0` seconds ago).

### Separate steps for restore and save

See [Always save cache](./caching-strategies.md#saving-cache-even-if-the-build-fails).

### Other examples

See [Merge caches](#merge-caches), [Example cache workflow](#example-cache-workflow), [Caching Strategies](#caching-strategies).

### Example workflow

See [ci.yaml](.github/workflows/ci.yaml) and its [runs](https://github.com/nix-community/cache-nix-action/actions/workflows/ci.yaml).

## Troubleshooting

- Use [action-tmate](https://github.com/mxschmitt/action-tmate) to connect to the runner via SSH.
- Use [action-debug-vscode](https://github.com/fawazahmed0/action-debug-vscode) to run a browser VSCode on the runner.

## Configuration

See [action.yml](action.yml).

<!-- action-docs-inputs action="action.yml" -->

### Inputs

| name                           | description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | required | default               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------- |
| `primary-key`                  | <ul> <li>When a non-empty string, the action uses this key for restoring and saving a cache.</li> <li>Otherwise, the action fails.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `true`   | `""`                  |
| `restore-prefixes-first-match` | <ul> <li>When a newline-separated non-empty list of non-empty key prefixes, when there's a miss on the <code>primary-key</code>, the action searches in this list for the first prefix for which there exists a cache whose key has this prefix, and the action tries to restore that cache.</li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `false`  | `""`                  |
| `restore-prefixes-all-matches` | <ul> <li>When a newline-separated non-empty list of non-empty key prefixes, when there's a miss on the <code>primary-key</code>, the action tries to restore all caches whose keys have these prefixes.</li> <li>Tries caches across all refs to make use of caches created on the current, base, and default branches (see <a href="https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache">docs</a>).</li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                                                                                           | `false`  | `""`                  |
| `lookup-only`                  | <ul> <li>When <code>true</code>, when there's a hit on the <code>primary-key</code>, the action doesn't restore any cache.</li> <li>Otherwise, the action can restore caches.</li> <li>Doesn't change the behavior of cache saving in any case.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `false`  | `false`               |
| `fail-on`                      | <ul> <li>Input form: <code>&lt;key type&gt;.&lt;result&gt;</code>.</li> <li><code>&lt;key type&gt;</code> options: <code>primary-key</code>, <code>first-match</code>.</li> <li><code>&lt;result&gt;</code> options: <code>miss</code>, <code>not-restored</code>.</li> <li>When the input satisfies the input form, when the event described in the input happens, the action fails.</li> <li>Example:<ul> <li>Input: <code>primary-key.not-restored</code>.</li> <li>Event: a cache could not be restored via the <code>primary-key</code>.</li></ul></li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                     | `false`  | `""`                  |
| `nix`                          | <ul> <li>Can have an effect only when the action runs on a <code>Linux</code> or a <code>macOS</code> runner.</li> <li>When <code>true</code>, the action can do Nix-specific things.</li> <li>Otherwise, the action doesn't do them.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `false`  | `true`                |
| `save`                         | <ul> <li>When <code>true</code>, the action can save a cache with the <code>primary-key</code>.</li> <li>Otherwise, the action can't save a cache.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `false`  | `true`                |
| `paths`                        | <ul> <li>When <code>nix: true</code>, the action uses <code>["/nix"]</code> as default paths.</li> <li>Otherwise, the action uses an empty list as default paths.</li> <li>When a newline-separated non-empty list of non-empty path patterns (see <a href="https://github.com/actions/toolkit/tree/main/packages/glob"><code>@actions/glob</code></a> for supported patterns), the action appends it to default paths and uses the resulting list for restoring and saving caches.</li> <li>Otherwise, the action uses default paths for restoring and saving caches.</li> </ul>                                                                                                                                                                                                                                                                                    | `false`  | `""`                  |
| `paths-macos`                  | <ul> <li>Overrides <code>paths</code>.</li> <li>Can have an effect only when the action runs on a <code>macOS</code> runner.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `false`  | `""`                  |
| `paths-linux`                  | <ul> <li>Overrides <code>paths</code>.</li> <li>Can have an effect only when the action runs on a <code>Linux</code> runner.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `false`  | `""`                  |
| `backend`                      | <p>Choose an implementation of the <code>cache</code> package.</p> <ul> <li>When <code>actions</code>, use the <a href="https://github.com/actions/toolkit/tree/main/packages/cache">actions version</a> from <a href="https://github.com/nix-community/cache-nix-action/tree/actions-toolkit/packages/cache">here</a>.</li> <li>When <code>buildjet</code>, use the <a href="https://github.com/BuildJet/toolkit/tree/main/packages/cache-buildjet">BuildJet version</a> from <a href="https://github.com/nix-community/cache-nix-action/tree/buildjet-toolkit/packages/cache">here</a>.</li> </ul>                                                                                                                                                                                                                                                                 | `false`  | `actions`             |
| `gc-max-store-size`            | <ul> <li>Can have an effect only when <code>nix: true</code>, <code>save: true</code>.</li> <li>The input has no effect if "primary-key" hit occurs when starting to save the new cache.</li> <li>When a non-negative integer number (possibly with a suffix), the action collects garbage (via <code>nix store gc --max ...</code>) until the Nix store size (in bytes) is at most this number just before the action tries to save a new cache.</li> <li>If you specify a suffix, it must be <code>K</code> (kibibytes, 2 ^ 10 bytes), <code>M</code> (mebibytes, 2 ^ 20 bytes) or <code>G</code> (gibibytes, 2 ^ 30 bytes), where <code>2 ^ N</code> means <code>2 to the power N</code>. Examples: <code>5G</code> (same as <code>5368709120</code>), <code>20M</code> (same as <code>20971520</code>).</li> <li>Otherwise, this input has no effect.</li> </ul> | `false`  | `""`                  |
| `gc-max-store-size-macos`      | <ul> <li>Overrides <code>gc-max-store-size</code>.</li> <li>Can have an effect only when the action runs on a <code>macOS</code> runner.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `false`  | `""`                  |
| `gc-max-store-size-linux`      | <ul> <li>Overrides <code>gc-max-store-size</code>.</li> <li>Can have an effect only when the action runs on a <code>Linux</code> runner.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `false`  | `""`                  |
| `purge`                        | <ul> <li>When <code>true</code>, the action purges (possibly zero) caches.</li> <li>The action purges only caches scoped to the current <a href="https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables">GITHUB_REF</a>.</li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `false`  | `false`               |
| `purge-primary-key`            | <ul> <li>Can have an effect only when <code>purge: true</code>.</li> <li>When <code>always</code>, the action always purges the cache with the <code>primary-key</code>.</li> <li>When <code>never</code>, the action never purges the cache with the <code>primary-key</code>.</li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `false`  | `""`                  |
| `purge-prefixes`               | <ul> <li>Can have an effect only when <code>purge: true</code>.</li> <li>When a newline-separated non-empty list of non-empty cache key prefixes, the action selects for purging all caches whose keys match some of these prefixes.</li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `false`  | `""`                  |
| `purge-last-accessed`          | <ul> <li>Can have an effect only when <code>purge: true</code>.</li> <li>When a non-negative number or a string in the <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/Duration#iso_8601_duration_format">ISO 8601 duration format</a>, the action purges selected caches that were last accessed more than this number of seconds or this duration before the start of the <code>Post Restore</code> phase. Examples: <code>0</code> (0 seconds), <code>P1DT12H</code> (1 day and 12 hours).</li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                            | `false`  | `""`                  |
| `purge-created`                | <ul> <li>Can have an effect only when <code>purge: true</code>.</li> <li>When a non-negative number or a string in the <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/Duration#iso_8601_duration_format">ISO 8601 duration format</a>, the action purges selected caches that were created more than this number of seconds or this duration before the start of the <code>Post Restore</code> phase. Examples: <code>0</code> (0 seconds), <code>P1DT12H</code> (1 day and 12 hours).</li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                                  | `false`  | `""`                  |
| `upload-chunk-size`            | <ul> <li>When a non-negative number, the action uses it as the chunk size (in bytes) to split up large files during upload.</li> <li>Otherwise, the action uses the default value <code>33554432</code> (32MB).</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `false`  | `""`                  |
| `token`                        | <ul> <li>The action uses it to communicate with GitHub API.</li> <li>If you use a personal access token, it must have the <code>repo</code> scope (<a href="https://docs.github.com/en/rest/actions/cache?apiVersion=2022-11-28#delete-github-actions-caches-for-a-repository-using-a-cache-key">link</a>).</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `false`  | `${{ github.token }}` |

<!-- action-docs-inputs action="action.yml" -->

<!-- action-docs-outputs action="action.yml" -->

### Outputs

| name              | description                                                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `primary-key`     | <ul> <li>A string.</li> <li>The <code>primary-key</code>.</li> </ul>                                                                                                                                                     |
| `hit`             | <ul> <li>A boolean string.</li> <li><code>'true'</code> when <code>hit-primary-key</code> is <code>true</code> or <code>hit-first-match</code> is <code>true</code>.</li> <li><code>'false'</code> otherwise.</li> </ul> |
| `hit-primary-key` | <ul> <li>A boolean string.</li> <li><code>'true'</code> when there was a hit on the <code>primary-key</code>.</li> <li><code>'false'</code> otherwise.</li> </ul>                                                        |
| `hit-first-match` | <ul> <li>A boolean string.</li> <li><code>'true'</code> when there was a hit on a key matching <code>restore-prefixes-first-match</code>.</li> <li><code>'false'</code> otherwise.</li> </ul>                            |
| `restored-key`    | <ul> <li>A string.</li> <li>The key of a cache restored via the <code>primary-key</code> or via the <code>restore-prefixes-first-match</code>.</li> <li>An empty string otherwise.</li> </ul>                            |
| `restored-keys`   | <ul> <li>A possibly empty array of strings (JSON).</li> <li>Keys of restored caches.</li> <li>Example: <code>["key1", "key2"]</code>.</li> </ul>                                                                         |

<!-- action-docs-outputs action="action.yml" -->

## Purge old caches

The `cache-nix-action` allows to delete old caches after saving a new cache (see `purge-*` inputs in [Inputs](#inputs) and the `compare-run-times` job in the [Example workflow](#example-workflow)).

The [purge-cache](https://github.com/MyAlbum/purge-cache) action allows to remove caches based on their `last accessed` or `created` time without branch limitations.

Alternatively, you can use the [GitHub Actions Cache API](https://docs.github.com/en/rest/actions/cache).

## Merge caches

`GitHub` evicts the least recently used caches when their total size exceeds `10GB` (see [Limitations](#limitations)).

If you have multiple similar caches produced on runners with **the same OS** (`Linux` or `macOS`), you can merge them into a single cache and store just it to save space.

In short:

1. Matrix jobs produce similar individual caches.
1. The next job restores all of these individual caches, saves a common cache, and purges individual caches.
1. On subsequent runs, matrix jobs use the common cache.

See the `make-similar-caches` and `merge-similar-caches` jobs in the [example workflow](#example-workflow).

**Pros**: if `N` individual caches are very similar, a common cache will take approximately `N` times less space.
**Cons**: if caches aren't very similar, the run time may increase due to a bigger common cache.

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

### Garbage collection tools

- GC by access time tracked in the Nix store DB: [PR](https://github.com/NixOS/nix/pull/14725).
- GC by `atime`: [nix-heuristic-gc](https://github.com/risicle/nix-heuristic-gc).
- GC via gc roots: [nix-cache-cut](https://github.com/astro/nix-cache-cut).
- GC based on time: [cache-gc](https://github.com/lheckemann/cache-gc).
- Visualize GC roots: [nix-du](https://github.com/symphorien/nix-du).

## Save Nix store paths from garbage collection

### Problems

One problem is that garbage collection doesn't differentiate between the least and the most recently used paths ([issue](https://github.com/NixOS/nix/issues/2793)).

Another problem is that derivations produced with the help of flake inputs don't retain references to these inputs ([issue](https://github.com/NixOS/nix/issues/4250), [issue](https://github.com/NixOS/nix/issues/6895)).

### Solution 1 - `saveFromGC`

The Nix function is defined in [`./saveFromGC.nix`](./saveFromGC.nix).

> [!WARNING]
> We don't guarantee that [`./saveFromGC.nix`](./saveFromGC.nix) will be available or won't have breaking changes in future.

Write an expression for a derivation that mentions the necessary paths and flake inputs. Next, [add it to a profile or build it](#solution-2---nix-profile-add-or-nix-build).

- **Pros**: Allows to include and exclude flake inputs in Nix expressions.
- **Cons**: Requires writing Nix expressions and running extra commands.

#### `saveFromGC` example

Example or a flake with `saveFromGC` (from [`./examples/saveFromGC/flake.nix`](./examples/saveFromGC/flake.nix)):

<!-- `$ cat flake.nix` as nix -->

```nix
{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/def3da69945bbe338c373fddad5a1bb49cf199ce";
    flake-utils = {
      url = "github:numtide/flake-utils";
      inputs.systems.follows = "systems";
    };
    cache-nix-action = {
      url = "github:nix-community/cache-nix-action";
      flake = false;
    };
    systems.url = "github:nix-systems/default";
  };
  outputs =
    inputs:
    inputs.flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = inputs.nixpkgs.legacyPackages.${system};

        packages = {
          hello = pkgs.hello;

          saveFromGC =
            (import "${inputs.cache-nix-action}/saveFromGC.nix" {
              inherit pkgs inputs;
              # The `cache-nix-action` input won't be saved.
              inputsInclude = [
                "nixpkgs"
                "flake-utils"
                "systems"
              ];
              derivations = [
                packages.hello
                devShells.default
              ];
              paths = [ "${packages.hello}/bin/hello" ];
            }).package;
        };

        devShells.default = pkgs.mkShell { buildInputs = [ pkgs.gcc ]; };
      in
      {
        inherit packages devShells;
      }
    );
}
```

Example of GitHub Actions steps:

```yaml
# ... Install Nix
#
# ... Restore cache

- name: Run gcc
  run: nix develop -c 'gcc --version'

- name: Run hello
  run: nix run .#hello -- --version

- name: Save packages from garbage collection
  run: nix profile add .#saveFromGC
# ... Collect garbage and save cache
```

### Solution 2 - `nix profile add` or `nix build`

Each profile [is](https://nix.dev/manual/nix/2.33/command-ref/new-cli/nix3-profile#filesystem-layout) a [garbage collection root](https://nix.dev/manual/nix/2.33/package-management/garbage-collector-roots.html#garbage-collector-roots).

Each [`nix build`](https://nix.dev/manual/nix/2.33/command-ref/new-cli/nix3-build) result symlink [is](https://nixos.org/guides/nix-pills/11-garbage-collector.html#indirect-roots) a garbage collection root.

To save particular Nix store paths, create an [installable](https://nix.dev/manual/nix/2.33/command-ref/new-cli/nix#installables) that contains these paths and

- either add it to a profile via [`nix profile add`](https://nix.dev/manual/nix/2.33/command-ref/new-cli/nix3-profile-add.html)
- or `nix build`

- **Pros**: Easy to use in CI.
- **Cons**: These commands save only output paths. Use the [solution 1](#solution-1---savefromgc) or [solution 3](#solution-3---nix-flake-archive) to save flake inputs.

#### Example with `saveFromGC`

The `saveFromGC` attribute of the flake above is a script (an installable) that contains paths of elements of the flake closure (the flake itself, flake inputs, inputs of these inputs, etc.).

Enter the [examples/saveFromGC](./examples/saveFromGC) directory.

```console
cd examples/saveFromGC
```

Print the contents of `saveFromGC`.

```$ as console
cat $(nix build .#saveFromGC --no-link --print-out-paths)
```

```console
# derivations:

- /nix/store/jrq3p609i85jsg27mr5zxm2imk3mjzyk-hello-2.12.2
- /nix/store/8xjhphvn58rrqydsx5569jn01yd5a0al-nix-shell

# derivationsAttrs:



# inputs:

- "flake-utils": /nix/store/01x5k4nlxcpyd85nnr0b9gm89rm8ff4x-source
- "nixpkgs": /nix/store/f3phg71mppsdj69cb63xllf1nnigzr2s-source
- "systems": /nix/store/yj1wxm9hh8610iyzqnz75kvs6xl8j3my-source

# paths:

- /nix/store/jrq3p609i85jsg27mr5zxm2imk3mjzyk-hello-2.12.2/bin/hello

# pathsAttrs:

```

Add the installable to the default profile.

```$ as console
nix profile remove examples/saveFromGC
nix profile add .#saveFromGC
nix profile list | grep save-from-gc
```

```console
Store paths:        /nix/store/6ypnwndqz9r8cxwywib0cysnbafzmp6f-save-from-gc
```

Or, build the installable and see the garbage collection roots that won't let it be garbage collected.

```console
nix-store --query --roots $(nix build .#saveFromGC --print-out-paths)
```

```console
nix-store --query --roots result
```

Output (edited):

<!-- `$ function fix_output { printf "$1" | sed -e 's|^.*\(/cache-nix-action/.*$\)|<...>\1|g' ; }; printf "...\n<...>/.local/state/nix/profiles/profile-1-link -> /nix/store/pyvyymji6pvgify5gvnlvprlrxi42pdd-profile\n";  fix_output "$(nix-store --query --roots $(nix build .#saveFromGC --print-out-paths) | grep 'save-from-gc')"` as console -->

```console
...
<...>/.local/state/nix/profiles/profile-1-link -> /nix/store/pyvyymji6pvgify5gvnlvprlrxi42pdd-profile
<...>/cache-nix-action/examples/saveFromGC/result -> /nix/store/6ypnwndqz9r8cxwywib0cysnbafzmp6f-save-from-gc
```

<!-- `$ nix profile remove examples/saveFromGC; rm result` -->

### Solution 3 - `nix flake archive`

[Implementation](https://github.com/NixOS/nix/issues/4250#issuecomment-1146878407).

- **Pros**: Can be run without adding any Nix code.
- **Cons**:
  - Requires custom bash code to exclude particular flake inputs if you decide not to save some of them.
  - Saves only flake inputs. To save output paths, use the [solution 1](#solution-1---savefromgc) together with the [solution 2](#solution-2---nix-profile-add-or-nix-build).

### Solution 4 - `direnv`

Run [`direnv`](https://direnv.net/) with [`nix-direnv`](https://github.com/nix-community/nix-direnv) in background.

- **Pros**: Can save both output paths and inputs.
- **Cons**: Like the [solution 3](#solution-3---nix-flake-archive), requires writing some code to exclude particular paths.

## Caching approaches

Initially discussed [here](https://github.com/DeterminateSystems/magic-nix-cache-action/issues/16) and [here](https://github.com/nixbuild/nix-quick-install-action/issues/33).

Caching approaches work at different "distances" from `/nix/store` of GitHub Actions runner.
These distances affect the restore and save speed.

### GitHub Actions

- [`nix-community/cache-nix-action`](#nix-communitycache-nix-action)
- [`DeterminateSystems/magic-nix-cache-action`](#determinatesystemsmagic-nix-cache-action)
- [`actions/cache`](#actionscache)
- [`rikhuijzer/cache-install`](#rikhuijzercache-install)

#### `nix-community/cache-nix-action`

[Link](https://github.com/nix-community/cache-nix-action)

**Pros**:

- Free.
- Easy to set up.
- Uses `GitHub Actions Cache` and works fast.
- Doesn't require repository secrets.
- Allows to save a store of at most a given size (see [Inputs](#inputs)).
- Allows to save outputs from garbage collection (see [Garbage collection](#garbage-collection)).
- When there's a cache hit, restoring from a GitHub Actions cache can be faster than downloading multiple paths from binary caches.
  - You can compare run times of jobs with and without store caching in [Actions](https://github.com/nix-community/cache-nix-action/actions/workflows/ci.yaml).
    - Open a run and click on the time under `Total duration`.

**Cons**: see [Limitations](#limitations)

#### `DeterminateSystems/magic-nix-cache-action`

[Link](https://github.com/DeterminateSystems/magic-nix-cache-action)

**Pros** ([source](https://github.com/DeterminateSystems/magic-nix-cache#why-use-the-magic-nix-cache)):

- Free.
- Easy to set up.
- Uses `GitHub Actions Cache` and works fast.
- Restores and saves paths selectively.

**Cons**:

- Collects telemetry ([link](https://github.com/DeterminateSystems/magic-nix-cache#telemetry))
- May trigger rate limit errors ([link](https://github.com/DeterminateSystems/magic-nix-cache#usage-notes)).
- Follows the GitHub Actions Cache semantics ([link](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache)).
  - Caches are isolated between branches ([link](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache)).
- Saves a cache for each path in a store and quickly litters `Caches`.

#### `actions/cache`

[Link](https://github.com/actions/cache)

If the action is used with [`nixbuild/nix-quick-install-action`](https://github.com/nixbuild/nix-quick-install-action), it's similar to the [`nix-community/cache-nix-action`](#nix-communitycache-nix-action).

If used with [`cachix/install-nix-action`](https://github.com/cachix/install-nix-action) and a [chroot local store](https://nix.dev/manual/nix/2.33/command-ref/new-cli/nix3-help-stores.html#local-store):

**Pros**:

- Quickly restores and saves `/tmp/nix`.
- `chroot` store works only on Linux.

**Cons**:

- Slow [`nix copy`](https://nix.dev/manual/nix/2.33/command-ref/new-cli/nix3-copy.html) from `/tmp/nix` to `/nix/store`.

If used with [`cachix/install-nix-action`](https://github.com/cachix/install-nix-action) and this [trick](https://github.com/cachix/install-nix-action/issues/56#issuecomment-1030697681), it's similar to the [`nix-community/cache-nix-action`](#nix-communitycache-nix-action) but slower ([link](https://github.com/ryantm/nix-installer-action-benchmark)).

#### `rikhuijzer/cache-install`

**Pros**:

- Quickly restores and saves `/nix/store`, some `/nix/var` files, and profiles ([link](https://github.com/rikhuijzer/cache-install/blob/f7a5251fe0711d671111afdf303db5b5aad8afbd/action.yml#L47-L53)).

**Cons**:

- Coupled with the installer ([link](https://github.com/rikhuijzer/cache-install/blob/f7a5251fe0711d671111afdf303db5b5aad8afbd/src/core.sh#L5)).

### Hosted binary caches

See [binary cache](https://nix.dev/manual/nix/2.33/glossary.html#gloss-binary-cache), [HTTP Binary Cache Store](https://nix.dev/manual/nix/2.33/command-ref/new-cli/nix3-help-stores.html#http-binary-cache-store).

- [`Cachix`](https://www.cachix.org/)
- [`Attic`](https://github.com/zhaofengli/attic)
- [`FlakeHub Cache`](https://flakehub.com/cache)

**Pros**:

- Restore and save paths selectively.
- Have free tier ([`Cachix`](https://www.cachix.org/pricing), Attic is [FOSS](https://github.com/zhaofengli/attic)).
- Provide least recently used garbage collection strategies ([`Cachix`](https://docs.cachix.org/garbage-collection?highlight=garbage), [`Attic`](https://github.com/zhaofengli/attic#goals)).
- Don't cache paths available from the NixOS cache ([`Cachix`](https://docs.cachix.org/garbage-collection?highlight=upstream)).
- Allow to share paths between projects ([`Cachix`](https://docs.cachix.org/getting-started#using-binaries-with-nix), [`FlakeHub Cache`](https://docs.determinate.systems/flakehub/cache/#pulling-from-the-cache)).

**Cons**:

- `Cachix` gives only 5GB for open-source projects ([src](https://www.cachix.org/pricing)).
- `FlakeHub Cache` is available only to paid accounts ([src](https://docs.determinate.systems/flakehub/cache/)).
- `Attic` needs to be hosted.
- Need good bandwidth for receiving and pushing paths over the Internet.
- Can be down.

## Contribute

### Clone the repository

```console
git clone --recurse-submodules https://github.com/nix-community/cache-nix-action
```

### Create issues

- Report errors, suggest improvements in [issues](https://github.com/nix-community/cache-nix-action/issues).

### Improve the code

- Read about [JavaScript actions](https://docs.github.com/en/actions/creating-actions/about-custom-actions?learn=create_actions&learnProduct=actions#javascript-actions)
- See main files:
  - [restoreImpl.ts](./src/restoreImpl.ts)
  - [saveImpl.ts](./src/saveImpl.ts)
- Improve them and other files.

### Improve action description

- Edit [action.nix](./action.nix).
- Update `action.yml`-s and `README.md`-s:

  ```console
  nix run .#write
  ```

### Update dependencies

- Update the `actions-toolkit` branch that contains a patched version of [actions/toolkit](https://github.com/actions/toolkit).
- Update the `buildjet-toolkit` branch that contains a patched version of [BuildJet/toolkit](https://github.com/BuildJet/toolkit) synchronized with [actions/toolkit](https://github.com/actions/toolkit).
- Update submodules for the mentioned branches on the `main` branch.

Example:

- `cd` into the toolkit directory
- commit changes
- `git push origin <branch>`

# Cache action (legacy description updated for the cache-nix-action)

This action allows caching dependencies and build outputs to improve workflow execution time.

> Two other actions are available in addition to the primary `cache` action:
>
> - [Restore action](./restore/README.md)
> - [Save action](./save/README.md)

[![Tests](https://github.com/actions/cache/actions/workflows/workflow.yml/badge.svg)](https://github.com/actions/cache/actions/workflows/workflow.yml)

## Documentation

See ["Caching dependencies to speed up workflows"](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows).

## What's New

### ⚠️ Important changes

> [!IMPORTANT]
> `actions/cache@v5` runs on the Node.js 24 runtime and requires a minimum Actions Runner version of `2.327.1`.
> If you are using self-hosted runners, ensure they are updated before upgrading.

The cache backend service has been rewritten from the ground up for improved performance and reliability. [actions/cache](https://github.com/actions/cache) now integrates with the new cache service (v2) APIs.

The new service will gradually roll out as of **February 1st, 2025**. The legacy service will also be sunset on the same date. Changes in these releases are **fully backward compatible**.

**We are deprecating some versions of this action**. We recommend upgrading to version `v4` or `v3` as soon as possible before **February 1st, 2025.** (Upgrade instructions below).

If you are using pinned SHAs, please use the SHAs of versions `v4.2.0` or `v3.4.0`.

If you do not upgrade, all workflow runs using any of the deprecated [actions/cache](https://github.com/actions/cache) will fail.

Upgrading to the recommended versions will not break your workflows.

> **Additionally, if you are managing your own GitHub runners, you must update your runner version to `2.231.0` or newer to ensure compatibility with the new cache service.**  
> Failure to update both the action version and your runner version may result in workflow failures after the migration date.

Read more about the change & access the migration guide: [reference to the announcement](https://github.com/actions/cache/discussions/1510).

### v5

- Updated to node 24
- Requires a minimum Actions Runner version of `2.327.1`

### v4

- Integrated with the new cache service (v2) APIs.
- Updated to node 20

### v3

- Integrated with the new cache service (v2) APIs.
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
- Support cross-os caching as an opt-in feature. See [Cross OS caching](./tips-and-workarounds.md#cross-os-cache) for more info.
- Added option to fail job on cache miss. See [Exit workflow on cache miss](./restore/README.md#exit-workflow-on-cache-miss) for more info.
- Fix zstd not being used after zstd version upgrade to 1.5.4 on hosted runners
- Added option to lookup cache without downloading it.
- Reduced segment size to 128MB and segment timeout to 10 minutes to fail fast in case the cache download is stuck.

See the [v2 README.md](https://github.com/actions/cache/blob/v2/README.md) for older updates.

## Usage

### Pre-requisites

Create a workflow `.yml` file in your repository's `.github/workflows` directory. An [example workflow](#example-cache-workflow) is available below. For more information, see the GitHub Help Documentation for [Creating a workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

If you are using this inside a container, a POSIX-compliant `tar` needs to be included and accessible from the execution path.

Note: `actions/cache@v5` runs on Node.js 24 and requires a minimum Actions Runner version of `2.327.1`.

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
      - uses: actions/checkout@v6

      - name: Cache Primes
        id: cache-primes
        uses: nix-community/cache-nix-action@v6
        with:
          primary-key: ${{ runner.os }}-primes
          paths: prime-numbers

      - name: Generate Prime Numbers
        if: steps.cache-primes.outputs.hit-primary-key != 'true'
        run: /generate-primes.sh -d prime-numbers

      - name: Use Prime Numbers
        run: /primes.sh -d prime-numbers
```

The `cache-nix-action` provides the `hit-primary-key` output which is set to `'true'` when the cache is restored using the `primary-key` and `'false'` otherwise.

#### Using a combination of restore and save actions

> [!NOTE]
> The `paths` input in the `cache-nix-action/restore` and `cache-nix-action/save` must be the same.

```yaml
name: Caching Primes

on: push

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v6

      - name: Restore cached Primes
        id: cache-primes-restore
        uses: nix-community/cache-nix-action/restore@v6
        with:
          primary-key: ${{ runner.os }}-primes
          paths: |
            path/to/dependencies
            some/other/dependencies

      # other steps

      - name: Save Primes
        id: cache-primes-save
        uses: nix-community/cache-nix-action/save@v6
        with:
          primary-key: ${{ steps.cache-primes-restore.outputs.cache-primary-key }}
          paths: |
            path/to/dependencies
            some/other/dependencies
```

> **Note**
> You must use the `cache` or `restore` action in your workflow before you need to use the files that might be restored from the cache. If the provided `primary-key` matches an existing cache, a new cache is not created and if the provided `primary-key` doesn't match an existing cache, a new cache is automatically created provided the job completes successfully.

## Caching Strategies

With the introduction of the `restore` and `save` actions, a lot of caching use cases can now be achieved. Please see the [caching strategies](./caching-strategies.md) document for understanding how you can use the actions strategically to achieve the desired goal.

## Implementation Examples

Every programming language and framework has its own way of caching.

See [Examples](examples.md) for a list of `nix-community/cache-nix-action` implementations for use with:

- [Bun](./examples.md#bun)
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
- uses: nix-community/cache-nix-action@v6
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

- uses: nix-community/cache-nix-action@v6
  with:
    primary-key: ${{ runner.os }}-${{ steps.get-date.outputs.date }}-${{ hashFiles('**/lockfiles') }}
    paths: path/to/dependencies
```

See [Using contexts to create cache keys](https://help.github.com/en/actions/configuring-and-managing-workflows/caching-dependencies-to-speed-up-workflows#using-contexts-to-create-cache-keys)

## Cache Limits

A repository can have up to 10GB of caches. Once the 10GB limit is reached, older caches will be evicted based on when the cache was last accessed.

Caches that are not accessed within the last week will also be evicted.

## Skipping steps based on hit-primary-key

Using the `hit-primary-key` output, subsequent steps (such as install or build) can be skipped when a cache hit occurs on the key.

It is recommended to install missing/updated dependencies in case of a partial key match when the key is dependent on the `hash` of the package file.

Example:

```yaml
steps:
  - uses: actions/checkout@v6

  - uses: nix-community/cache-nix-action@v6
    id: cache
    with:
      primary-key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
      paths: path/to/dependencies

  - name: Install Dependencies
    if: steps.cache.outputs.hit-primary-key != 'true'
    run: /install.sh
```

> **Note** The `id` defined in `nix-community/cache-nix-action` must match the `[id]` in the `if` statement (i.e. `steps.[id].outputs.hit-primary-key`)

## Cache Version

Cache version is a hash [generated](https://github.com/actions/toolkit/blob/500d0b42fee2552ae9eeb5933091fe2fbf14e72d/packages/cache/src/internal/cacheHttpClient.ts#L73-L90) for a combination of compression tool used (Gzip, Zstd, etc. based on the runner OS) and the `paths` of directories being cached. If two caches have different versions, they are identified as unique caches while matching. This, for example, means that a cache created on a `windows-latest` runner can't be restored on `ubuntu-latest` as cache `Version`s are different.

> Pro tip: The [list caches](https://docs.github.com/en/rest/actions/cache#list-github-actions-caches-for-a-repository) API can be used to get the version of a cache. This can be helpful to troubleshoot cache miss due to version.

<details>
  <summary>Example</summary>

The workflow will create 3 unique caches with same keys. `Ubuntu` and `Windows` runners will use different compression technique and hence create two different caches. And `build-linux` will create two different caches as the `paths` are different.

```yaml
jobs:
  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Cache Primes
        id: cache-primes
        uses: nix-community/cache-nix-action@v6
        with:
          primary-key: primes
          paths: prime-numbers

      - name: Generate Prime Numbers
        if: steps.cache-primes.outputs.hit-primary-key != 'true'
        run: ./generate-primes.sh -d prime-numbers

      - name: Cache Numbers
        id: cache-numbers
        uses: nix-community/cache-nix-action@v6
        with:
          primary-key: primes
          paths: numbers

      - name: Generate Numbers
        if: steps.cache-numbers.outputs.hit-primary-key != 'true'
        run: ./generate-primes.sh -d numbers

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v6

      - name: Cache Primes
        id: cache-primes
        uses: nix-community/cache-nix-action@v6
        with:
          primary-key: primes
          paths: prime-numbers

      - name: Generate Prime Numbers
        if: steps.cache-primes.outputs.hit-primary-key != 'true'
        run: ./generate-primes -d prime-numbers
```

</details>

## Known practices and workarounds

There are a number of community practices/workarounds to fulfill specific requirements. You may choose to use them if they suit your use case. Note these are not necessarily the only solution or even a recommended solution.

- [Cache segment restore timeout](./tips-and-workarounds.md#cache-segment-restore-timeout)
- [Update a cache](./tips-and-workarounds.md#update-a-cache)
- [Use cache across feature branches](./tips-and-workarounds.md#use-cache-across-feature-branches)
- [Cross OS cache](./tips-and-workarounds.md#cross-os-cache)
- [Force deletion of caches overriding default cache eviction policy](./tips-and-workarounds.md#force-deletion-of-caches-overriding-default-cache-eviction-policy)

### Windows environment variables

Please note that Windows environment variables (like `%LocalAppData%`) will NOT be expanded by this action. Instead, prefer using `~` in your paths which will expand to the HOME directory. For example, instead of `%LocalAppData%`, use `~\AppData\Local`. For a list of supported default environment variables, see the [Learn GitHub Actions: Variables](https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables) page.

## Note

We would love for you to contribute to `nix-community/cache-nix-action`. Pull requests are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) for more information.

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
