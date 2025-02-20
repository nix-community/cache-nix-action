# https://github.com/NixOS/nix/issues/6895#issuecomment-2475461113
{
  lib,
  pkgs,
  inputs,
  ...
}:

let
  inherit (builtins) concatMap attrValues concatStringsSep;
  inherit (lib) unique;
  mkFlakesClosure =
    flakes:
    if flakes == [ ] then
      [ ]
    else
      unique (
        flakes
        ++ mkFlakesClosure (
          concatMap (flake: if flake ? inputs then attrValues flake.inputs else [ ]) flakes
        )
      );
  mkFlakeClosure =
    flake:
    pkgs.writeScriptBin "flake-closure" (concatStringsSep "\n" (mkFlakesClosure [ flake ]) + "\n");
in
mkFlakeClosure inputs.self
