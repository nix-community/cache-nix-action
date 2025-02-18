{ target, lib }:
let
  specific =
    {
      cache = {
        name = "Cache";
        description = "Restore and save";
        actions = "restoring and saving";
        main = "dist/restore/index.js";
        post = ''
          post: "dist/save/index.js"
            post-if: "success() || github.event.inputs.save-always"'';
      };
      save = {
        name = "Save";
        description = "Save";
        actions = "saving";
        main = "../dist/save-only/index.js";
        post = "";
      };
      restore = {
        name = "Restore";
        description = "Restore";
        actions = "restoring";
        main = "../dist/restore-only/index.js";
        post = "";
      };
    }
    .${target};

  q = txt: "`${txt}`";
  whenListOf = "When a newline-separated non-empty list of non-empty";
  pathsDefault = ''`["/nix", "~/.cache/nix", "~root/.cache/nix"]`'';
  nixTrue = "nix: true";

  pathsWhen = ''${whenListOf} path patterns (see [`@actions/glob`](https://github.com/actions/toolkit/tree/main/packages/glob) for supported patterns), the action appends it to default paths and uses the resulting list for ${specific.actions} caches.'';
  pathsOtherwise = ''Otherwise, the action uses default paths for ${specific.actions} caches.'';

  effectOnlyOn =
    platform: ''Can have an effect only when the action runs on a ${q platform} runner.'';
  linux = "Linux";
  macos = "macOS";
  effectOnlyWhen =
    conditions: "Can have an effect only when ${lib.concatMapStringsSep ", " q conditions}.";

  noEffectOtherwise = ''Otherwise, this input has no effect.'';

  gcWhen = ''When a number, the action collects garbage until Nix store size (in bytes) is at most this number just before the action tries to save a new cache.'';

  overrides = input: "Overrides ${q input}.";

  paths = "paths";
  gc-max-store-size = "gc-max-store-size";
  primary-key = "primary-key";
  restore-prefixes-first-match = "restore-prefixes-first-match";
  hit-primary-key = "hit-primary-key";
  hit-first-match = "hit-first-match";
in
''
  name: "${specific.name} Nix store"
  description: "${specific.description} Nix store using GitHub Actions cache to speed up workflows."
  author: "GitHub"
  inputs:
    ${primary-key}:
      description: |
        - When a non-empty string, the action uses this key for ${specific.actions} a cache.
        - Otherwise, the action fails.
      required: true
    
    ${
      if target == "cache" || target == "restore" then
        ''
          ${restore-prefixes-first-match}:
              description: |
                - ${whenListOf} key prefixes, when there's a miss on the ${q primary-key}, 
                  the action searches in this list for the first prefix
                  for which there exists a cache whose key has this prefix,
                  and the action tries to restore that cache.
                - ${noEffectOtherwise}
              default: ""

            restore-prefixes-all-matches:
              description: |
                - ${whenListOf} key prefixes, when there's a miss on the ${q primary-key},
                  the action tries to restore all caches whose keys have these prefixes.
                  - Tries caches across all refs to make use of caches created 
                    on the current, base, and default branches 
                    (see [docs](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache)).
                - ${noEffectOtherwise}
              default: ""

            skip-restore-on-hit-primary-key:
              description: |
                - When `true`, when there's a hit on the ${q primary-key}, the action doesn't restore the found cache.
                - Otherwise, the action restores the cache.
              default: "false"

            fail-on:
              description: |
                - Input form: `<key type>.<result>`.
                - `<key type>` options: ${q primary-key}, `first-match`.
                - `<result>` options: `miss`, `not-restored`.
                - When the input satisfies the input form, when the event described in the input happens, the action fails.
                  - Example:
                    - Input: `${primary-key}.not-restored`.
                    - Event: a cache could not be restored via the ${q primary-key}.
                - ${noEffectOtherwise}
              default: ""''
      else
        ""
    }

    nix:
      description: |
        - Can have an effect only when the action runs on a ${q linux} or a ${q macos} runner.
        - When `true`, the action can do Nix-specific things.
        - Otherwise, the action doesn't do them.
      default: "true"

    save:
      description: |
        - When `true`, the action can save a cache with the ${q primary-key}.
        - Otherwise, the action can't save a cache.
      default: "true"

    ${paths}:
      description: |
        - When ${q nixTrue}, the action uses ${pathsDefault} as default paths, as suggested [here](https://github.com/divnix/nix-cache-action/blob/b14ec98ae694c754f57f8619ea21b6ab44ccf6e7/action.yml#L7).
        - Otherwise, the action uses an empty list as default paths.
        - ${pathsWhen}
        - ${pathsOtherwise}
      default: ""
    ${paths}-macos:
      description: |
        - ${overrides paths}
        - ${effectOnlyOn macos}
      default: ""
    ${paths}-linux:
      description: |
        - ${overrides paths}
        - ${effectOnlyOn linux}
      default: ""
    
    backend:
      description: |
        Choose an implementation of the `cache` package.
        - When `actions`, use the [actions version](https://github.com/actions/toolkit/tree/main/packages/cache) from [here](https://github.com/nix-community/cache-nix-action/tree/actions-toolkit/packages/cache).
        - When `buildjet`, use the [BuildJet version](https://github.com/BuildJet/toolkit/tree/main/packages/cache-buildjet) from [here](https://github.com/nix-community/cache-nix-action/tree/buildjet-toolkit/packages/cache).
      default: 'actions'
      required: false

    ${
      if target == "cache" || target == "save" then
        ''
          ${gc-max-store-size}:
              description: |
                - ${
                  effectOnlyWhen [
                    nixTrue
                    "save: true"
                  ]
                }
                - ${gcWhen}
                - ${noEffectOtherwise}
              default: ""
            ${gc-max-store-size}-macos:
              description: |
                - ${overrides gc-max-store-size}
                - ${effectOnlyOn macos}
              default: ""
            ${gc-max-store-size}-linux:
              description: |
                - ${overrides gc-max-store-size}
                - ${effectOnlyOn linux}
              default: ""

            purge:
              description: |
                - When `true`, the action purges (possibly zero) caches.
                - ${noEffectOtherwise}
              default: "false"
            purge-${primary-key}:
              description: |
                - ${effectOnlyWhen [ "purge: true" ]}
                - When `always`, the action always purges cache with the ${q primary-key}.
                - When `never`, the action never purges cache with the ${q primary-key}.
                - ${noEffectOtherwise}
              default: ""
            purge-prefixes:
              description: |
                - ${effectOnlyWhen [ "purge: true" ]}
                - ${whenListOf} cache key prefixes, the action selects for purging all caches whose keys match some of these prefixes and that are scoped to the current [GITHUB_REF](https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables).
                - ${noEffectOtherwise}
              default: ""
            purge-last-accessed:
              description: |
                - ${effectOnlyWhen [ "purge: true" ]}
                - When a non-negative number, the action purges selected caches that were last accessed more than this number of seconds ago relative to the start of the `Post Restore` phase.
                - ${noEffectOtherwise}
              default: ""
            purge-created:
              description: |
                - ${effectOnlyWhen [ "purge: true" ]}
                - When a non-negative number, the action purges selected caches that were created more than this number of seconds ago relative to the start of the `Post Restore` phase.
                - ${noEffectOtherwise}
              default: ""

            upload-chunk-size:
              # The original default value may be provided here (https://github.com/actions/cache/issues/1292)
              # 32MB
              description: |
                - When a non-negative number, the action uses it as the chunk size (in bytes) to split up large files during upload.
                - Otherwise, the action uses the default value `33554432` (32MB).
              default: ""
        ''
      else
        ""
    }

    token:
      description: |
        - The action uses it to communicate with GitHub API.
        - If you use a personal access token, it must have the `repo` scope ([link](https://docs.github.com/en/rest/actions/cache?apiVersion=2022-11-28#delete-github-actions-caches-for-a-repository-using-a-cache-key)).
      default: ''${{ github.token }}
  ${
    if target == "cache" || target == "restore" then
      ''
        outputs:
          ${primary-key}:
            description: |
              - A string.
              - The ${q primary-key}.

          hit:
            description: |
              - A boolean value.
              - `true` when ${q hit-primary-key} is `true` or ${q hit-first-match} is `true`.
              - `false` otherwise.
          ${hit-primary-key}:
            description: |
              - A boolean value.
              - `true` when there was a hit on the ${q primary-key}.
              - `false` otherwise.
          ${hit-first-match}:
            description: |
              - A boolean value.
              - `true` when there was a hit on a key matching ${q restore-prefixes-first-match}.
              - `false` otherwise.

          restored-key:
            description: |
              - A string.
              - The key of a cache restored via the ${q primary-key} or via the ${q restore-prefixes-first-match}.
              - An empty string otherwise.

          restored-keys:
            description: |
              - A possibly empty array of strings (JSON).
              - Keys of restored caches.
              - Example: `["key1", "key2"]`.''
    else
      ""
  }
  runs:
    using: "node20"
    main: "${specific.main}"
    ${specific.post}
  branding:
    icon: "archive"
    color: "gray-dark"''
