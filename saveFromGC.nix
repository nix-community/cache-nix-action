# https://github.com/NixOS/nix/issues/6895#issuecomment-2475461113
{
  pkgs,
  # flake inputs
  inputs,
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
    mkFlakesClosure
    lib.unique
    # the current flake will probably change next time
    # hence, we only save its inputs
    # if you want to save the flake, put "self" into "derivations"
    (filter (x: x != inputs.self))
  ];

  saveFromGC = pkgs.writeScriptBin "save-from-gc" (
    concatStringsSep "\n\n" (
      lib.attrsets.mapAttrsToList (name: value: "${name}\n${concatStringsSep "\n" value}") {
        inherit closure derivations paths;
      }
    )
  );
in
saveFromGC
