# Restore action

The restore action restores a cache. It works similarly to the `cache` action except that it doesn't have a post step to save the cache. This action provides granular ability to restore a cache without having to save it. It accepts the same set of inputs as the `cache` action.

## Documentation

### Inputs

<table><tr><th>name</th><th>description</th><th>default</th><th>required</th></tr><tr><td><div><p><code>primary-key</code></p></div></td><td><div><ul><li>When a non-empty string, the action uses this key for restoring a cache.</li><li>Otherwise, the action fails.</li></ul></div></td><td><div/></td><td><div><p><code>true</code></p></div></td></tr><tr><td><div><p><code>restore-prefixes-first-match</code></p></div></td><td><div><ul><li>When a newline-separated non-empty list of non-empty key prefixes, when there's a miss on the <code>primary-key</code>,   the action searches in this list for the first prefix for which there exists a cache   with a matching key and the action tries to restore that cache.</li><li>Otherwise, this input has no effect.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>restore-prefixes-all-matches</code></p></div></td><td><div><ul><li>When a newline-separated non-empty list of non-empty key prefixes, the action tries to restore   all caches whose keys match these prefixes.</li><li>Tries caches across all refs to make use of caches created     on the current, base, and default branches     (see <a href="https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache">docs</a>).</li><li>Otherwise, this input has no effect.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>skip-restore-on-hit-primary-key</code></p></div></td><td><div><ul><li>Can have an effect only when <code>restore-prefixes-first-match</code> has no effect.</li><li>When <code>true</code>, when there's a hit on the <code>primary-key</code>, the action doesn't restore caches.</li><li>Otherwise, this input has no effect.</li></ul></div></td><td><div><p><code>false</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>fail-on</code></p></div></td><td><div><ul><li>Input form: <code>&lt;key type&gt;.&lt;result&gt;</code>.</li><li><code>&lt;key type&gt;</code> options: <code>primary-key</code>, <code>first-match</code>.</li><li><code>&lt;result&gt;</code> options: <code>miss</code>, <code>not-restored</code>.</li><li>When the input satisfies the input form, when the event described in the input happens, the action fails.</li><li>Example:<ul><li>Input: <code>primary-key.not-restored</code>.</li><li>Event: a cache could not be restored via the <code>primary-key</code>.</li></ul></li><li>Otherwise, this input has no effect.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>nix</code></p></div></td><td><div><ul><li>Can have an effect only when the action runs on a <code>Linux</code> or a <code>macOS</code> runner.</li><li>When <code>true</code>, the action can do Nix-specific things.</li><li>Otherwise, the action doesn't do them.</li></ul></div></td><td><div><p><code>true</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>save</code></p></div></td><td><div><ul><li>When <code>true</code>, the action can save a cache with the <code>primary-key</code>.</li><li>Otherwise, the action can't save a cache.</li></ul></div></td><td><div><p><code>true</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>paths</code></p></div></td><td><div><ul><li>When <code>nix: true</code>, the action uses <code>["/nix", "~/.cache/nix", "~root/.cache/nix"]</code> as default paths, as suggested <a href="https://github.com/divnix/nix-cache-action/blob/b14ec98ae694c754f57f8619ea21b6ab44ccf6e7/action.yml#L7">here</a>.</li><li>Otherwise, the action uses an empty list as default paths.</li><li>When a newline-separated non-empty list of non-empty path patterns (see <a href="https://github.com/actions/toolkit/tree/main/packages/glob"><code>@actions/glob</code></a> for supported patterns), the action appends it to default paths and uses the resulting list for restoring caches.</li><li>Otherwise, the action uses default paths for restoring caches.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>paths-macos</code></p></div></td><td><div><ul><li>Overrides <code>paths</code>.</li><li>Can have an effect only when the action runs on a <code>macOS</code> runner.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>paths-linux</code></p></div></td><td><div><ul><li>Overrides <code>paths</code>.</li><li>Can have an effect only when the action runs on a <code>Linux</code> runner.</li></ul></div></td><td><div><p><code>''</code></p></div></td><td><div><p><code>false</code></p></div></td></tr><tr><td><div><p><code>token</code></p></div></td><td><div><p>The action uses it to communicate with GitHub API.</p></div></td><td><div><p><code>${{ github.token }}</code></p></div></td><td><div><p><code>false</code></p></div></td></tr></table>

### Outputs

<table><tr><th>name</th><th>description</th></tr><tr><td><div><p><code>primary-key</code></p></div></td><td><div><ul><li>A string.</li><li>The <code>primary-key</code>.</li></ul></div></td></tr><tr><td><div><p><code>hit</code></p></div></td><td><div><ul><li>A boolean value.</li><li><code>true</code> when <code>hit-primary-key</code> is <code>true</code> or <code>hit-first-match</code> is <code>true</code>.</li><li><code>false</code> otherwise.</li></ul></div></td></tr><tr><td><div><p><code>hit-primary-key</code></p></div></td><td><div><ul><li>A boolean value.</li><li><code>true</code> when there was a hit on the <code>primary-key</code>.</li><li><code>false</code> otherwise.</li></ul></div></td></tr><tr><td><div><p><code>hit-first-match</code></p></div></td><td><div><ul><li>A boolean value.</li><li><code>true</code> when there was a hit on a key matching <code>restore-prefixes-first-match</code>.</li><li><code>false</code> otherwise.</li></ul></div></td></tr><tr><td><div><p><code>restored-key</code></p></div></td><td><div><ul><li>A string.</li><li>The key of a cache restored via the <code>primary-key</code> or via the <code>restore-prefixes-first-match</code>.</li><li>An empty string otherwise.</li></ul></div></td></tr><tr><td><div><p><code>restored-keys</code></p></div></td><td><div><ul><li>A possibly empty array of strings (JSON).</li><li>Keys of restored caches.</li><li>Example: <code>["key1", "key2"]</code>.</li></ul></div></td></tr></table>

### Environment Variables

* `SEGMENT_DOWNLOAD_TIMEOUT_MINS` - Segment download timeout (in minutes, default `10`) to abort download of the segment if not completed in the defined number of minutes. [Read more](https://github.com/actions/cache/blob/main/tips-and-workarounds.md#cache-segment-restore-timeout)

## Use cases

As this is a newly introduced action to give users more control in their workflows, below are some use cases where one can use this action.

### Only restore cache

If you are using separate jobs to create and save your cache(s) to be reused by other jobs in a repository, this action will take care of your cache restoring needs.

```yaml
steps:
  - uses: actions/checkout@v3

  - uses: actions/cache/restore@v3
    id: cache
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}

  - name: Install Dependencies
    if: steps.cache.outputs.cache-hit != 'true'
    run: /install.sh

  - name: Build
    run: /build.sh

  - name: Publish package to public
    run: /publish.sh
```

Once the cache is restored, unlike `actions/cache`, this action won't run a post step to do post-processing, and the rest of the workflow will run as usual.

### Save intermediate private build artifacts

In case of multi-module projects, where the built artifact of one project needs to be reused in subsequent child modules, the need to rebuild the parent module again and again with every build can be eliminated. The `actions/cache` or `actions/cache/save` action can be used to build and save the parent module artifact once, and it can be restored multiple times while building the child modules.

#### Step 1 - Build the parent module and save it

```yaml
steps:
  - uses: actions/checkout@v3

  - name: Build
    run: /build-parent-module.sh

  - uses: actions/cache/save@v3
    id: cache
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```

#### Step 2 - Restore the built artifact from cache using the same key and path

```yaml
steps:
  - uses: actions/checkout@v3

  - uses: actions/cache/restore@v3
    id: cache
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}

  - name: Install Dependencies
    if: steps.cache.outputs.cache-hit != 'true'
    run: /install.sh

  - name: Build
    run: /build-child-module.sh

  - name: Publish package to public
    run: /publish.sh
```

### Exit workflow on cache miss

You can use `fail-on-cache-miss: true` to exit a workflow on a cache miss. This way you can restrict your workflow to only build when there is a `cache-hit`.

To fail if there is no cache hit for the primary key, leave `restore-keys` empty!

```yaml
steps:
  - uses: actions/checkout@v3

  - uses: actions/cache/restore@v3
    id: cache
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
      fail-on-cache-miss: true

  - name: Build
    run: /build.sh
```

## Tips

### Reusing primary key and restored key in the save action

Usually you may want to use the same `key` with both `actions/cache/restore` and `actions/cache/save` actions. To achieve this, use `outputs` from the `restore` action to reuse the same primary key (or the key of the cache that was restored).

### Using restore action outputs to make save action behave just like the cache action

The outputs `cache-primary-key` and `cache-restored-key` can be used to check if the restored cache is same as the given primary key. Alternatively, the `cache-hit` output can also be used to check if the restored was a complete match or a partially restored cache.

### Ensuring proper restores and save happen across the actions

It is very important to use the same `key` and `path` that were used by either `actions/cache` or `actions/cache/save` while saving the cache. Learn more about cache key [naming](https://github.com/actions/cache#creating-a-cache-key) and [versioning](https://github.com/actions/cache#cache-version) here.
