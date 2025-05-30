# https://github.com/NixOS/nix/issues/6895#issuecomment-2475461113
{
  pkgs,
  # flake inputs
  # their transitive inputs will be included
  inputs,
  # flake inputs to exclude
  # their transitive inputs will be excluded
  # unless they're transitive inputs of any included inputs
  inputsExclude ? [ ],
  # derivations like pkgs.hello
  derivations ? [ ],
  # paths like /nix/store/p09fxxwkdj69hk4mgddk4r3nassiryzc-hello-2.12.1
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
    flakes: if flakes == [ ] then [ ] else flakes ++ mkFlakesClosure (getInputs flakes);

  closure = lib.trivial.pipe inputs [
    attrValues
    # the current flake will probably change next time
    # hence, we only save its inputs
    # if you want to save the flake, put "self" into "derivations"
    (filter (x: x != inputs.self))
    # we need to exclude particular inputs
    # before we collect their transitive inputs
    (filter (x: !(builtins.elem x inputsExclude)))
    mkFlakesClosure
    lib.unique
    (filter (x: x != inputs.self))
  ];

  # we don't have much more info
  # so, we're just printing the paths
  saveFromGC = pkgs.writeScriptBin "save-from-gc" (
    concatStringsSep "\n\n" (
      lib.attrsets.mapAttrsToList (name: value: "${name}\n${concatStringsSep "\n" value}") {
        inherit closure derivations paths;
      }
    )
  );
in
{
  inherit
    getInputs
    mkFlakesClosure
    closure
    saveFromGC
    ;
}
