{ target, lib }:
let
  specific = {
    cache = {
      description = "Restore and save";
      actions = "restoring and saving";
      main = "dist/restore/index.js";
      post =
        ''
          post: "dist/save/index.js"
            post-if: success()'';
    };
    save = {
      description = "Save";
      actions = "saving";
      main = "../dist/save-only/index.js";
      post = "";
    };
    restore = {
      description = "Restore";
      actions = "restoring";
      main = "../dist/restore-only/index.js";
      post = "";
    };
  }.${target};

  q = txt: "`${txt}`";
  whenListOf = "When a newline-separated non-empty list of non-empty";
  pathsDefault = ''`["/nix", "~/.cache/nix", "~root/.cache/nix"]`'';
  nixTrue = "nix: true";

  pathsDefaultWhenNix = ''When ${q nixTrue}, uses ${pathsDefault} as default paths. Otherwise, uses an empty list as default paths.'';
  pathsWhen = ''${whenListOf} path patterns (see [`@actions/glob`](https://github.com/actions/toolkit/tree/main/packages/glob) for supported patterns), the action appends it to default paths and uses the resulting list for ${specific.actions} caches.'';
  pathsOtherwise = ''Otherwise, the action uses default paths for ${specific.actions} caches.'';

  effectOnlyOn = platform: ''Can have an effect only when on a ${q platform} runner.'';
  effectOnlyOnLinux = effectOnlyOn "Linux";
  effectOnlyOnMacOS = effectOnlyOn "macOS";
  effectOnlyWhenHasEffect = input: "Can have an effect only when ${q input} has effect.";
  effectOnlyWhen = conditions: "Can have an effect only when ${lib.concatMapStringsSep ", " q conditions}.";
  effectOnlyWhenNixEnabled = effectOnlyWhen [ nixTrue ];

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
    name: "${specific.description} Nix store"
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
                the action searches in this list for the first prefix for which there exists a cache 
                with a matching key and the action tries to restore that cache.
              - Otherwise, this input has no effect.
            default: ""
          restore-prefixes-all-matches:
            description: |
              - ${whenListOf} key prefixes, the action tries to restore 
                all caches whose keys match these prefixes.
              - Otherwise, this input has no effect.
            default: ""
        
          skip-restore-on-hit-primary-key:
            description: |
              - Can have an effect only when ${q restore-prefixes-first-match} has no effect.
              - When `true`, when there's a hit on the ${q primary-key}, the action doesn't restore caches.
              - Otherwise, this input has no effect.
            default: "false"
        
          fail-on:
            description: |
              - Input form: `<key type>.<result>`.
              - `<key type>` options: `primary`, `first-match`.
              - `<result>` options: `miss`, `not-restored`.
              - When the input satisfies the input form, when the event described in the input happens, the action fails.
              - Example:
                - Input: `primary.not-restored`.
                - Event: a cache could not be restored via the ${q primary-key}.''
        else ""
      }

      nix:
        description: |
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
          - ${pathsDefaultWhenNix}
          - ${pathsWhen}
          - ${pathsOtherwise}
        default: ""
      ${paths}-macos:
        description: |
          - ${overrides paths}
          - ${effectOnlyOnMacOS}
          - ${pathsDefaultWhenNix}
          - ${pathsWhen}
          - ${pathsOtherwise}
        default: ""
      ${paths}-linux:
        description: |
          - ${overrides paths}
          - ${effectOnlyOnLinux}
          - ${pathsDefaultWhenNix}
          - ${pathsWhen}
          - ${pathsOtherwise}
        default: ""

      ${
        if target == "cache" || target == "save" then 
  ''
    ${gc-max-store-size}:
        description: |
          - ${effectOnlyWhen [nixTrue "save: true"]}
          - ${gcWhen}
          - ${noEffectOtherwise}
        default: ""
      ${gc-max-store-size}-macos:
        description: |
          - ${effectOnlyWhen [nixTrue "save: true"]}
          - ${overrides gc-max-store-size}
          - ${effectOnlyOnMacOS}
          - ${gcWhen}
          - ${noEffectOtherwise}
        default: ""
      ${gc-max-store-size}-linux:
        description: |
          - ${effectOnlyWhen [nixTrue "save: true"]}
          - ${overrides gc-max-store-size}
          - ${effectOnlyOnLinux}
          - ${gcWhen}
          - ${noEffectOtherwise}
        default: ""
    
      purge:
        description: |
          - When `true`, the action purges (possibly zero) caches.
          - ${noEffectOtherwise}
        default: "false"
      purge-overwrite:
        description: |
          - ${effectOnlyWhen ["purge: true"]}
          - When `always`, the action always purges cache with the ${q primary-key}.
          - When `never`, the action never purges cache with the ${q primary-key}.
          - Otherwise, the action purges old caches using purging criteria.
        default: ""
      purge-prefixes:
        description: |
          - ${effectOnlyWhen ["purge: true"]}
          - ${whenListOf} cache key prefixes, the action collects all cache keys that match these prefixes.
          - ${noEffectOtherwise}
        default: ""
      purge-last-accessed:
        description: |
          - ${effectOnlyWhen ["purge: true"]}
          - When a number, the action selects for purging caches last accessed more than this number of seconds ago relative to the start of the Save phase.
          - ${noEffectOtherwise}
        default: ""
      purge-created:
        description: |
          - ${effectOnlyWhen ["purge: true"]}
          - When a number, the action selects for purging caches created more than this number of seconds ago relative to the start of the Save phase.
          - ${noEffectOtherwise}
        default: ""
    
      upload-chunk-size:
        # The original default value may be provided here (https://github.com/actions/cache/issues/1292)
        # 32MB
        description: |
          - When a number, the action uses it as the chunk size (in bytes) to split up large files during upload.
          - Otherwise, the action uses the default value `33554432` (32MB).
        default: ""''
      else ""}

      token:
        description: The action uses it to communicate with GitHub API.
        default: ''${{ github.token }}
    ${
      if target == "cache" || target == "restore" then
    ''
    outputs:
      primary-key:
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
      else ""
    }
    runs:
      using: "node16"
      main: "${specific.main}"
      ${specific.post}
    branding:
      icon: "archive"
      color: "gray-dark"''
