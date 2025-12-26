# https://github.com/NixOS/nix/issues/6895#issuecomment-2475461113
{
  pkgs,
  # Flake inputs.
  # Their transitive inputs will be included
  inputs ? { },
  # Derivations like 'pkgs.hello'
  derivations ? [ ],
  # Paths like '/nix/store/p09fxxwkdj69hk4mgddk4r3nassiryzc-hello-2.12.1'
  paths ? [ ],
}:
assert builtins.isList derivations;
let
  inherit (builtins)
    concatMap
    attrValues
    concatStringsSep
    filter
    ;
  inherit (pkgs) lib;

  getInputs =
    flakes: concatMap (flake: if flake ? inputs then attrValues flake.inputs else [ ]) flakes;

  mkFlakesClosure =
    flakes': flakes:
    if flakes == [ ] then
      flakes'
    else
      let
        flakes'' = lib.unique (flakes' ++ flakes);
      in
      mkFlakesClosure flakes'' (filter (x: !builtins.elem x flakes'') (getInputs flakes));

  flakesClosure = lib.trivial.pipe inputs [
    attrValues
    # The current flake will probably change next time.
    # Hence, we only save its inputs.
    # If you want to save the flake, put "self" into "derivations".
    (filter (x: x != (inputs.self or { })))
    (mkFlakesClosure [ ])
    lib.unique
    (filter (x: x != (inputs.self or { })))
  ];

  # We don't have much more info.
  # Therefore, we're just printing the paths.
  saveFromGC = pkgs.writeScriptBin "save-from-gc" (
    concatStringsSep "\n\n" (
      lib.attrsets.mapAttrsToList (name: value: "${name}\n${concatStringsSep "\n" value}") {
        inherit flakesClosure derivations paths;
      }
    )
  );
in
{
  inherit
    getInputs
    mkFlakesClosure
    flakesClosure
    saveFromGC
    ;
}
