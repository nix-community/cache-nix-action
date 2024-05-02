{ lib, backend }:
let
  mkIndents = indentationLevel: lib.concatMapStrings (x: " ") (lib.genList (x: x) indentationLevel);
  indent =
    indentationLevel: s:
    lib.trivial.pipe s [
      (lib.splitString "\n")
      (
        x:
        lib.head x + "\n" + (lib.concatMapStringsSep "\n" (y: mkIndents indentationLevel + y) (lib.tail x))
      )
    ];

  mkChoose =
    cond: option1: option2:
    if cond then option1 else option2;

  choose = mkChoose (backend == "actions");

  backend_ = choose "" (''
    # use BuildJet backend
    backend: buildjet
  '');

  on = choose (indent 2 ''
    push:
      # don't run on tags, run on commits
      # https://github.com/orgs/community/discussions/25615
      tags-ignore:
        - "**"
      branches:
        - main
    pull_request:
    schedule:
      - cron: 0 0 * * *'') "";

  name = choose "" ''with BuildJet backend'';
  # https://stackoverflow.com/a/71158878
  git_pull = ''''${{
            github.head_ref
              && format('gh pr checkout {0}', github.event.pull_request.number) 
              || format('git pull --rebase origin {0}', github.ref_name) 
          }}'';
          
  nix-quick-install-action = ''
    - uses: nixbuild/nix-quick-install-action@v28
  '';
in
''
  name: Nix CI ${name}
  on:
    ${on}
    workflow_dispatch:

  env:
    pin_nixpkgs: nix registry pin nixpkgs github:NixOS/nixpkgs/807c549feabce7eddbf259dbdcec9e0600a0660d
    # required for gh
    GITHUB_TOKEN: ''${{ secrets.GITHUB_TOKEN }}

  jobs:
    # Build the action
    # Commit and push the built code
    build:
      name: Build the action
      runs-on: ubuntu-20.04
      permissions:
        contents: write
        actions: write
      steps:
        - uses: actions/checkout@v4
          with:
            submodules: true

        ${indent 6 nix-quick-install-action}

        - name: Restore and save Nix store
          uses: ./.
          with:
            primary-key: build-''${{ runner.os }}-''${{ hashFiles('**/package-lock.json', 'package.json', 'flake.nix', 'flake.lock') }}
            paths: |
              ~/.npm
            # do purge caches
            purge: true
            # purge all versions of the cache
            purge-prefixes: build-''${{ runner.os }}-
            # created more than 0 seconds ago relative to the start of the `Post Restore` phase
            purge-created: 0
            # except the version with the `primary-key`, if it exists
            purge-primary-key: never
            ${indent 10 backend_}

        # # Uncomment to debug this job
        # - name: Setup tmate session
        #   uses: mxschmitt/action-tmate@v3

        - name: Configure git
          run: |
            ${ git_pull }

            git config --global user.name "github-actions[bot]"
            git config --global user.email "github-actions[bot]@users.noreply.github.com"

        - name: Install packages & Build the action
          run: nix run .#install

        - name: Update docs
          run: nix run .#write

        - name: Commit & push changes
          run: |
            git add dist
            git commit -m "chore: build the action" || echo "Nothing to commit"
            git add .
            git commit -m "chore: update docs" || echo "Nothing to commit"
            git push

    # Make `individual` caches
    # Restore `individual` or `common` caches
    # Usually, there should be no `individual` caches to restore as they're purged by `merge-similar-caches`
    make-similar-caches:
      name: Make similar caches
      needs: build
      permissions:
        actions: write
      strategy:
        matrix:
          os:
            - macos-11
            - macos-12
            - ubuntu-20.04
            - ubuntu-22.04
          id:
            - 1
            - 2
      runs-on: ''${{ matrix.os }}
      steps:
        - name: Checkout this repo
          uses: actions/checkout@v4

        - name: Rebase
          run: |
            ${ git_pull }

        ${indent 6 nix-quick-install-action}

        - name: Restore Nix store - ''${{ matrix.id }}
          id: restore
          uses: ./restore
          with:
            # save a new cache every time `ci.yaml` changes
            primary-key: similar-cache-''${{ matrix.os }}-individual-''${{ matrix.id }}-''${{ hashFiles('.github/workflows/ci.yaml') }}
            # otherwise, restore a common cache if and only if it matches the current `ci.yaml`
            restore-prefixes-first-match: similar-cache-''${{ matrix.os }}-common-''${{ hashFiles('.github/workflows/ci.yaml') }}

        - name: Pin nixpkgs
          run: ''${{ env.pin_nixpkgs }}

        - name: Install nixpkgs#poetry
          if: ''${{ matrix.id == 1 }}
          run: nix profile install nixpkgs#poetry

        - name: Install nixpkgs#nodejs
          if: ''${{ matrix.id == 2 }}
          run: nix profile install nixpkgs#nodejs
          
        - name: Save Nix store - ''${{ matrix.id }}
          if: steps.restore.outputs.hit == 'false'
          uses: ./save
          with:
            # save a new cache every time `ci.yaml` changes
            primary-key: similar-cache-''${{ matrix.os }}-individual-''${{ matrix.id }}-''${{ hashFiles('.github/workflows/ci.yaml') }}
            # do purge caches
            purge: true
            # purge all versions of the cache
            purge-prefixes: similar-cache-''${{ matrix.os }}-individual-''${{ matrix.id }}-
            # created more than 0 seconds ago relative to the start of the `Post Restore` phase
            purge-created: 0
            # except the version with the `primary-key`, if it exists
            purge-primary-key: never
            ${indent 10 backend_}
''
+ (
  let
    mergeSimilarCaches =
      check:
      let
        choose = mkChoose check;
      in
      indent 2 ''

        ${choose "# Check that the `common` cache is restored correctly" ''
          # Merge similar `individual` caches
          # Purge `individual` caches and old `common` caches
          # Save new `common` caches''}
        merge-similar-caches${choose "-check" ""}:
          name: ${choose "Check a `common` cache is restored correctly" "Merge similar caches"}
          needs: ${choose "merge-similar-caches" "make-similar-caches"}
          permissions:
            actions: write
          strategy:
            matrix:
              os:
                - macos-11
                - macos-12
                - ubuntu-20.04
                - ubuntu-22.04
          runs-on: ''${{ matrix.os }}
          steps:
            - name: Checkout this repo
              uses: actions/checkout@v4

            - name: Rebase
              run: |
                ${ git_pull }

            ${indent 4 nix-quick-install-action}

            - name: Restore${choose "" " and save"} Nix store
              uses: ./${if check then "restore" else "."}
              with:
                primary-key: similar-cache-''${{ matrix.os }}-common-''${{ hashFiles('.github/workflows/ci.yaml') }}
                ${
                  choose "" (
                    indent 8 ''
                      # if no hit, restore current versions of individual caches
                      restore-prefixes-all-matches: |
                        similar-cache-''${{ matrix.os }}-individual-1-''${{ hashFiles('.github/workflows/ci.yaml') }}
                        similar-cache-''${{ matrix.os }}-individual-2-''${{ hashFiles('.github/workflows/ci.yaml') }}
                      # do purge caches
                      purge: true
                      # purge old versions of the `common` cache and any versions of individual caches
                      purge-prefixes: |
                        similar-cache-''${{ matrix.os }}-common-
                        similar-cache-''${{ matrix.os }}-individual-
                      # created more than 0 seconds ago relative to the start of the `Post Restore` phase
                      purge-created: 0
                      # except the version with the `primary-key`, if it exists
                      purge-primary-key: never''
                  )
                }
                ${indent 8 backend_}
            
            - name: Pin nixpkgs
              run: ''${{ env.pin_nixpkgs }}

            # Stuff in a profile can survive garbage collection.
            # Therefore, profiles are ignored when restoring a cache.
            # So, the current profile should be the default profile created by nix-quick-install-action.
            # The default profile should contain only nix.
            - name: List profile
              run: nix profile list

            - name: Check that the profile doesn't have anything apart from `nix`
              shell: bash
              run: |
                [[ "$(nix profile list --json | jq -rc '.elements | keys | .[]')" == "nix" ]]

            - name: Install nixpkgs#poetry
              run: nix profile install nixpkgs#poetry

            - name: Install nixpkgs#nodejs
              run: nix profile install nixpkgs#nodejs

            - name: Run poetry
              run: poetry --version

            - name: Run node
              run: node --version
      '';
  in
  ''
    ${mergeSimilarCaches false}
    ${mergeSimilarCaches true}
  ''
)
+ ''
  # 
    compare-run-times:
      name: Job with caching
      needs:
        - merge-similar-caches
        - merge-similar-caches-check
      permissions:
        actions: write
      strategy:
        matrix:
          do-cache:
            - true
            - false
          os:
            - macos-11
            - macos-12
            - ubuntu-20.04
            - ubuntu-22.04
      runs-on: ''${{ matrix.os }}
      steps:
        - name: Checkout this repo
          uses: actions/checkout@v4

        - name: Rebase
          run: |
            ${ git_pull }

        ${indent 6 nix-quick-install-action}

        - name: Restore and save Nix store
          if: ''${{ matrix.do-cache }}
          uses: ./.
          with:
            # save a new cache every time ci file changes
            primary-key: cache-''${{ matrix.os }}-''${{ hashFiles('.github/workflows/ci.yaml') }}
            restore-prefixes-first-match: cache-''${{ matrix.os }}-
            # do purge caches
            purge: true
            # purge all versions of the cache
            purge-prefixes: cache-''${{ matrix.os }}-
            # created more than 0 seconds ago relative to the start of the `Post Restore` phase
            purge-created: 0
            # except the version with the `primary-key`, if it exists
            purge-primary-key: never
            # and collect garbage in the Nix store until it reaches this size in bytes
            gc-max-store-size: 8000000000
            ${indent 10 backend_}

        # Uncomment to debug this job
        # - name: Setup tmate session
        #   uses: mxschmitt/action-tmate@v3

        - name: Show profile
          run: nix profile list

        - name: Pin nixpkgs
          run: ''${{ env.pin_nixpkgs }}

        - name: List registry
          run: nix registry list

        - name: Install nixpkgs
          run: nix profile install $(nix flake archive nixpkgs --json | jq -r '.path')

        - name: Show profile
          run: nix profile list

        - name: Install nixpkgs#hello
          run: |
            nix profile install nixpkgs#hello

        - name: Install nixpkgs#cachix
          run: |
            nix profile install nixpkgs#cachix

        - name: Install nixpkgs#nixpkgs-fmt
          run: |
            nix profile install nixpkgs#nixpkgs-fmt

        - name: Install nixpkgs#alejandra
          run: |
            nix profile install nixpkgs#alejandra

        - name: Install nixpkgs#nixd
          run: |
            nix profile install nixpkgs#nixd

        - name: Install nixpkgs#ghc
          run: |
            nix profile install nixpkgs#ghc

        - name: Install nixpkgs#haskell-language-server
          run: |
            nix profile install nixpkgs#haskell-language-server

        - name: Install nixpkgs#purescript
          run: |
            nix profile install nixpkgs#purescript

        - name: Install nixpkgs#nodejs
          run: |
            nix profile install nixpkgs#nodejs

        - name: Show profile
          run: nix profile list
''
