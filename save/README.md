# Save action

The save action saves a cache. It works similarly to the `cache` action except that it doesn't first do a restore. This action provides granular ability to save a cache without having to restore it, or to do a save at any stage of the workflow job -- not only in post phase.

## Documentation

### Inputs

<table><tr><th>name</th><th>description</th><th>default</th><th>required</th></tr><tr><td><div><p><code>key</code></p></div></td><td><div><p>The primary key for saving a cache.</p></div></td><td><div/></td><td><div><p><code>true</code></p></div></td></tr><tr><td><div><p><code>paths</code></p></div></td><td><div><ul><li>When a newline-separated non-empty list of non-empty path regex expressions, appends them to [<code>/nix</code>, <code>~/.cache/nix</code>, <code>~root/.cache/nix</code>] and uses the resulting list for restoring and saving caches.</li><li>Otherwise, uses [<code>/nix</code>, <code>~/.cache/nix</code>, <code>~root/.cache/nix</code>] for restoring and saving caches.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>paths-macos</code></p></div></td><td><div><ul><li>Overrides <code>paths</code>.</li><li>Can have effect only on a <code>macOS</code> runner.</li><li>When a newline-separated non-empty list of non-empty path regex expressions, appends them to [<code>/nix</code>, <code>~/.cache/nix</code>, <code>~root/.cache/nix</code>] and uses the resulting list for restoring and saving caches.</li><li>Otherwise, uses [<code>/nix</code>, <code>~/.cache/nix</code>, <code>~root/.cache/nix</code>] for restoring and saving caches.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>paths-linux</code></p></div></td><td><div><ul><li>Overrides <code>paths</code>.</li><li>Can have effect only on a <code>Linux</code> runner.</li><li>When a newline-separated non-empty list of non-empty path regex expressions, appends them to [<code>/nix</code>, <code>~/.cache/nix</code>, <code>~root/.cache/nix</code>] and uses the resulting list for restoring and saving caches.</li><li>Otherwise, uses [<code>/nix</code>, <code>~/.cache/nix</code>, <code>~root/.cache/nix</code>] for restoring and saving caches.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>gc-max-store-size</code></p></div></td><td><div><ul><li>When a number, collects garbage until Nix store size (in bytes) is at most this number just before trying to save a new cache.</li><li>Otherwise, has no effect.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>gc-max-store-size-macos</code></p></div></td><td><div><ul><li>Overrides 'gc-max-store-size'.</li><li>Can have effect only on a <code>macOS</code> runner.</li><li>When a number, collects garbage until Nix store size (in bytes) is at most this number just before trying to save a new cache.</li><li>Otherwise, has no effect.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>gc-max-store-size-linux</code></p></div></td><td><div><ul><li>Overrides 'gc-max-store-size'.</li><li>Can have effect only on a <code>Linux</code> runner.</li><li>When a number, collects garbage until Nix store size (in bytes) is at most this number just before trying to save a new cache.</li><li>Otherwise, has no effect.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>purge</code></p></div></td><td><div><ul><li>When <code>true</code>, purges (possibly zero) old caches.</li><li>Otherwise, has no effect.</li></ul></div></td><td><div><p><code>false</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>purge-overwrite</code></p></div></td><td><div><ul><li>Can have effect only if <code>purge: true</code>.</li><li>When <code>always</code>, always purges old cache(s) with the primary <code>key</code> before saving a new cache with the primary <code>key</code>.</li><li>When <code>never</code>, never purges old cache(s) with the primary <code>key</code> and never saves a new cache with the primary <code>key</code>.</li><li>Otherwise, purges old caches using purging criteria before saving a new cache with the primary <code>key</code>.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>purge-keys</code></p></div></td><td><div><ul><li>Can have effect only if <code>purge: true</code>.</li><li>When a newline-separated non-empty list of non-empty cache key prefixes, collects for purging all cache keys that match these prefixes.</li><li>Otherwise, has no effect.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>purge-accessed-max-age</code></p></div></td><td><div><ul><li>Can have effect only if <code>purge-keys</code> has effect.</li><li>When a number, purges caches last accessed more than this number of seconds ago relative to the start of the cache saving phase.</li><li>Otherwise, has no effect on purging.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>purge-created-max-age</code></p></div></td><td><div><ul><li>Can have effect only if <code>purge-keys</code> has effect.</li><li>When a number, purges caches created more than this number of seconds ago relative to the start of the Save phase.</li><li>Otherwise, has no effect on purging.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>upload-chunk-size</code></p></div></td><td><div><p>When a number, uses it as the chunk size (in bytes) to split up large files during upload.</p></div></td><td><div><p><code>33554432</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>token</code></p></div></td><td><div><p>Used to communicate with GitHub API.</p></div></td><td><div><p><code>${{ github.token }}</code></p></div></td><td><div><p><code>false</code></p></div></td></tr></table>

### Outputs

This action has no outputs.

## Use cases

### Only save cache

If you are using separate jobs for generating common artifacts and sharing them across jobs, this action will take care of your cache saving needs.

```yaml
steps:
  - uses: actions/checkout@v3

  - name: Install Dependencies
    run: /install.sh

  - name: Build artifacts
    run: /build.sh

  - uses: actions/cache/save@v3
    id: cache
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```

### Re-evaluate cache key while saving

With this save action, the key can now be re-evaluated while executing the action. This helps in cases where lockfiles are generated during the build.

Let's say we have a restore step that computes a key at runtime.

#### Restore a cache

```yaml
uses: actions/cache/restore@v3
id: restore-cache
with:
    key: cache-${{ hashFiles('**/lockfiles') }}
```

#### Case 1 - Where a user would want to reuse the key as it is

```yaml
uses: actions/cache/save@v3
with:
    key: ${{ steps.restore-cache.outputs.cache-primary-key }}
```

#### Case 2 - Where the user would want to re-evaluate the key

```yaml
uses: actions/cache/save@v3
with:
    key: npm-cache-${{hashfiles(package-lock.json)}}
```

### Always save cache

There are instances where some flaky test cases would fail the entire workflow and users would get frustrated because the builds would run for hours and the cache couldn't be saved as the workflow failed in between. For such use-cases, users now have the ability to use the `actions/cache/save` action to save the cache by using an `if: always()` condition. This way the cache will always be saved if generated, or a warning will be generated that nothing is found on the cache path. Users can also use the `if` condition to only execute the `actions/cache/save` action depending on the output of previous steps. This way they get more control of when to save the cache.

```yaml
steps:
  - uses: actions/checkout@v3
  .
  . // restore if need be
  .
  - name: Build
    run: /build.sh
  - uses: actions/cache/save@v3
    if: always() // or any other condition to invoke the save action
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```
