{ target }:
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
  pathsDefault = "[`/nix`, `~/.cache/nix`, `~root/.cache/nix`]";
  pathsWhen = ''${whenListOf} path regex expressions, the action appends it to ${pathsDefault} and uses the resulting list for ${specific.actions} caches.'';
  pathsOtherwise = ''Otherwise, the action uses ${pathsDefault} for ${specific.actions} caches.'';
  effectOnlyOn = platform: ''Can have an effect only when on a ${q platform} runner.'';
  effectOnlyOnLinux = effectOnlyOn "Linux";
  effectOnlyOnMacOS = effectOnlyOn "macOS";
  effectWhen = input: "Can have an effect only when ${q input} has effect.";
  gcWhen = ''When a number, the action collects garbage until Nix store size (in bytes) is at most this number just before trying to save a new cache.'';
  inputNoEffect = ''Otherwise, this input has no effect.'';
  overrides = input: "Overrides ${q input}.";
  paths = "paths";

  gc-max-store-size = "gc-max-store-size";
  primary-key = "primary-key";
  prefixes-first-match = "prefixes-first-match";
  hit-primary = "hit-primary";
  hit-first-match = "hit-first-match";
in
''
    name: "Cache Nix store"
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
        ${prefixes-first-match}:
            description: |
              - ${whenListOf} key prefixes, when there's a miss on the ${q primary-key}, 
                the action searches in this list for the first prefix for which there exists a cache 
                with a matching key and tries to restore that cache.
              - Otherwise, this input has no effect.
            default: ""
        
          prefixes-all-matches:
            description: |
              - ${whenListOf} key prefixes, the action tries to restore 
                all caches whose keys match these prefixes.
              - Otherwise, this input has no effect.
            default: ""
        
          skip-restore-on-primary-key-hit:
            description: |
              - Can have an effect only when ${q prefixes-first-match} has no effect.
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

      ${paths}:
        description: |
          - ${pathsWhen}
          - ${pathsOtherwise}
        default: ""
      ${paths}-macos:
        description: |
          - ${overrides paths}
          - ${effectOnlyOnMacOS}
          - ${pathsWhen}
          - ${pathsOtherwise}
        default: ""
      ${paths}-linux:
        description: |
          - ${overrides paths}
          - ${effectOnlyOnLinux}
          - ${pathsWhen}
          - ${pathsOtherwise}
        default: ""
    
      ${
        if target == "cache" || target == "save" then 
  ''
    ${gc-max-store-size}:
        description: |
          - ${gcWhen}
          - ${inputNoEffect}
        default: ""
      ${gc-max-store-size}-macos:
        description: |
          - ${overrides gc-max-store-size}
          - ${effectOnlyOnMacOS}
          - ${gcWhen}
          - ${inputNoEffect}
        default: ""
      ${gc-max-store-size}-linux:
        description: |
          - ${overrides gc-max-store-size}
          - ${effectOnlyOnLinux}
          - ${gcWhen}
          - ${inputNoEffect}
        default: ""
    
      purge:
        description: |
          - When `true`, the action purges (possibly zero) old caches.
          - ${inputNoEffect}
        default: "false"
      purge-overwrite:
        description: |
          - ${effectWhen "purge"}
          - When `always`, the action always purges old cache(s) with the ${q primary-key} and saves a new cache with the ${q primary-key}.
          - When `never`, the action never purges old cache(s) with the ${q primary-key} and saves a new cache when there's a miss on the ${q primary-key}.
          - Otherwise, the action purges old caches using purging criteria and saves a new cache when there's a miss on the ${q primary-key}.
        default: ""
      purge-prefixes:
        description: |
          - ${effectWhen "purge"}
          - ${whenListOf} cache key prefixes, the action collects for purging all cache keys that match these prefixes.
          - ${inputNoEffect}
        default: ""
      purge-last-accessed:
        description: |
          - ${effectWhen "purge-prefixes"}
          - When a number, the action purges caches last accessed more than this number of seconds ago relative to the start of the Save phase.
          - ${inputNoEffect}
        default: ""
      purge-created:
        description: |
          - ${effectWhen "purge-prefixes"}
          - When a number, the action purges caches created more than this number of seconds ago relative to the start of the Save phase.
          - ${inputNoEffect}
        default: ""
    
      upload-chunk-size:
        # The original default value may be provided here (https://github.com/actions/cache/issues/1292)
        # 32MB
        description: |
          - When a number, the action uses it as the chunk size (in bytes) to split up large files during upload.
          - Otherwise, the action uses the default value `33554432` (32MB).
        default: ""
    
      token:
        description: The action uses it to communicate with GitHub API.
        default: ''${{ github.token }}'' 
      else ""
    }
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
          - `true` when ${q hit-primary} is `true` or ${q hit-first-match} is `true`.
          - `false` otherwise.
      ${hit-primary}:
        description: |
          - A boolean value.
          - `true` when a cache was found (not restored) via the ${q primary-key}.
          - `false` otherwise.
      ${hit-first-match}:
        description: |
          - A boolean value.
          - `true` when a cache was found (not restored) via the ${q prefixes-first-match}.
          - `false` otherwise.
    
      restored-key:
        description: |
          - A string.
          - The key of a cache restored via the ${q primary-key} or via the ${q prefixes-first-match}.
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
