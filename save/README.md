# Save action

The save action saves a cache. It works similarly to the `cache` action except that it doesn't first do a restore. This action provides granular ability to save a cache without having to restore it, or to do a save at any stage of the workflow job -- not only in post phase.

## Configuration

<!-- action-docs-inputs action="action.yml" -->

### Inputs

| name                      | description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | required | default               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------- |
| `primary-key`             | <ul> <li>When a non-empty string, the action uses this key for saving a cache.</li> <li>Otherwise, the action fails.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `true`   | `""`                  |
| `nix`                     | <ul> <li>Can have an effect only when the action runs on a <code>Linux</code> or a <code>macOS</code> runner.</li> <li>When <code>true</code>, the action can do Nix-specific things.</li> <li>Otherwise, the action doesn't do them.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `false`  | `true`                |
| `save`                    | <ul> <li>When <code>true</code>, the action can save a cache with the <code>primary-key</code>.</li> <li>Otherwise, the action can't save a cache.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `false`  | `true`                |
| `paths`                   | <ul> <li>When <code>nix: true</code>, the action uses <code>["/nix"]</code> as default paths.</li> <li>Otherwise, the action uses an empty list as default paths.</li> <li>When a newline-separated non-empty list of non-empty path patterns (see <a href="https://github.com/actions/toolkit/tree/main/packages/glob"><code>@actions/glob</code></a> for supported patterns), the action appends it to default paths and uses the resulting list for saving caches.</li> <li>Otherwise, the action uses default paths for saving caches.</li> </ul>                                                                                                                                                                                                                                                                                                                | `false`  | `""`                  |
| `paths-macos`             | <ul> <li>Overrides <code>paths</code>.</li> <li>Can have an effect only when the action runs on a <code>macOS</code> runner.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `false`  | `""`                  |
| `paths-linux`             | <ul> <li>Overrides <code>paths</code>.</li> <li>Can have an effect only when the action runs on a <code>Linux</code> runner.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `false`  | `""`                  |
| `backend`                 | <p>Choose an implementation of the <code>cache</code> package.</p> <ul> <li>When <code>actions</code>, use the <a href="https://github.com/actions/toolkit/tree/main/packages/cache">actions version</a> from <a href="https://github.com/nix-community/cache-nix-action/tree/actions-toolkit/packages/cache">here</a>.</li> <li>When <code>buildjet</code>, use the <a href="https://github.com/BuildJet/toolkit/tree/main/packages/cache-buildjet">BuildJet version</a> from <a href="https://github.com/nix-community/cache-nix-action/tree/buildjet-toolkit/packages/cache">here</a>.</li> </ul>                                                                                                                                                                                                                                                                 | `false`  | `actions`             |
| `gc-max-store-size`       | <ul> <li>Can have an effect only when <code>nix: true</code>, <code>save: true</code>.</li> <li>The input has no effect if "primary-key" hit occurs when starting to save the new cache.</li> <li>When a non-negative integer number (possibly with a suffix), the action collects garbage (via <code>nix store gc --max ...</code>) until the Nix store size (in bytes) is at most this number just before the action tries to save a new cache.</li> <li>If you specify a suffix, it must be <code>K</code> (kibibytes, 2 ^ 10 bytes), <code>M</code> (mebibytes, 2 ^ 20 bytes) or <code>G</code> (gibibytes, 2 ^ 30 bytes), where <code>2 ^ N</code> means <code>2 to the power N</code>. Examples: <code>5G</code> (same as <code>5368709120</code>), <code>20M</code> (same as <code>20971520</code>).</li> <li>Otherwise, this input has no effect.</li> </ul> | `false`  | `""`                  |
| `gc-max-store-size-macos` | <ul> <li>Overrides <code>gc-max-store-size</code>.</li> <li>Can have an effect only when the action runs on a <code>macOS</code> runner.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `false`  | `""`                  |
| `gc-max-store-size-linux` | <ul> <li>Overrides <code>gc-max-store-size</code>.</li> <li>Can have an effect only when the action runs on a <code>Linux</code> runner.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `false`  | `""`                  |
| `purge`                   | <ul> <li>When <code>true</code>, the action purges (possibly zero) caches.</li> <li>The action purges only caches scoped to the current <a href="https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables">GITHUB_REF</a>.</li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `false`  | `false`               |
| `purge-primary-key`       | <ul> <li>Can have an effect only when <code>purge: true</code>.</li> <li>When <code>always</code>, the action always purges the cache with the <code>primary-key</code>.</li> <li>When <code>never</code>, the action never purges the cache with the <code>primary-key</code>.</li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `false`  | `""`                  |
| `purge-prefixes`          | <ul> <li>Can have an effect only when <code>purge: true</code>.</li> <li>When a newline-separated non-empty list of non-empty cache key prefixes, the action selects for purging all caches whose keys match some of these prefixes.</li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `false`  | `""`                  |
| `purge-last-accessed`     | <ul> <li>Can have an effect only when <code>purge: true</code>.</li> <li>When a non-negative number or a string in the <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/Duration#iso_8601_duration_format">ISO 8601 duration format</a>, the action purges selected caches that were last accessed more than this number of seconds or this duration before the start of the Save step. Examples: <code>0</code> (0 seconds), <code>P1DT12H</code> (1 day and 12 hours).</li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                                                  | `false`  | `""`                  |
| `purge-created`           | <ul> <li>Can have an effect only when <code>purge: true</code>.</li> <li>When a non-negative number or a string in the <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/Duration#iso_8601_duration_format">ISO 8601 duration format</a>, the action purges selected caches that were created more than this number of seconds or this duration before the start of the Save step. Examples: <code>0</code> (0 seconds), <code>P1DT12H</code> (1 day and 12 hours).</li> <li>Otherwise, this input has no effect.</li> </ul>                                                                                                                                                                                                                                                                                        | `false`  | `""`                  |
| `upload-chunk-size`       | <ul> <li>When a non-negative number, the action uses it as the chunk size (in bytes) to split up large files during upload.</li> <li>Otherwise, the action uses the default value <code>33554432</code> (32MB).</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `false`  | `""`                  |
| `token`                   | <ul> <li>The action uses it to communicate with GitHub API.</li> <li>If you use a personal access token, it must have the <code>repo</code> scope (<a href="https://docs.github.com/en/rest/actions/cache?apiVersion=2022-11-28#delete-github-actions-caches-for-a-repository-using-a-cache-key">link</a>).</li> </ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `false`  | `${{ github.token }}` |

<!-- action-docs-inputs action="action.yml" -->

### Outputs

This action has no outputs.

## Use cases

### Only save cache

If you are using separate jobs for generating common artifacts and sharing them across jobs, this action will take care of your cache saving needs.

```yaml
steps:
  - uses: actions/checkout@v6

  - name: Install Dependencies
    run: /install.sh

  - name: Build artifacts
    run: /build.sh

  - uses: nix-community/cache-nix-action@v7
    id: cache
    with:
      primary-key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
      paths: path/to/dependencies
```

### Re-evaluate cache key while saving

With this save action, the key can now be re-evaluated while executing the action. This helps in cases where lockfiles are generated during the build.

Let's say we have a restore step that computes a key at runtime.

#### Restore a cache

```yaml
uses: nix-community/cache-nix-action@v7
id: restore-cache
with:
  primary-key: cache-${{ hashFiles('**/lockfiles') }}
```

#### Case 1 - Where a user would want to reuse the key as it is

```yaml
uses: nix-community/cache-nix-action@v7
with:
  primary-key: ${{ steps.restore-cache.outputs.primary-key }}
```

#### Case 2 - Where the user would want to re-evaluate the key

```yaml
uses: nix-community/cache-nix-action@v7
with:
  primary-key: npm-cache-${{hashfiles(package-lock.json)}}
```

### Always save cache

There are instances where some flaky test cases would fail the entire workflow and users would get frustrated because the builds would run for hours and the cache couldn't be saved as the workflow failed in between.
For such use-cases, users now have the ability to use the `nix-community/cache-nix-action/save` action to save the cache by using an [`always()`](https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/expressions#always) condition.
This way the cache will always be saved if generated, or a warning will be generated that nothing is found on the cache path. Users can also use the `if` condition to only execute the `nix-community/cache-nix-action/save` action depending on the output of previous steps. This way they get more control of when to save the cache.

To avoid saving a cache that already exists, the `hit-primary-key` output from a restore step should be checked.

The `primary-key` output from the restore step should also be used to ensure
the cache key does not change during the build if it's calculated based on file contents.

Here's an example where we imagine we're calculating a lot of prime numbers and want to cache them:

> [!NOTE]
> The `paths` input in the `cache-nix-action/restore` and `cache-nix-action/save` must be the same.

```yaml
name: Always Caching Prime Numbers

on: push

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v6

      - name: Restore cached Prime Numbers
        id: cache-prime-numbers-restore
        uses: nix-community/cache-nix-action/restore@v6
        with:
          primary-key: ${{ runner.os }}-prime-numbers
          paths: |
            path/to/dependencies
            some/other/dependencies

      # Intermediate workflow steps

      - name: Always Save Prime Numbers
        id: cache-prime-numbers-save
        if: always() && steps.cache-prime-numbers-restore.outputs.hit-primary-key != 'true'
        uses: nix-community/cache-nix-action/save@v6
        with:
          primary-key: ${{ steps.cache-prime-numbers-restore.outputs.primary-key }}
          paths: |
            path/to/dependencies
            some/other/dependencies
```
