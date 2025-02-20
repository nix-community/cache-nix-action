# https://github.com/NixOS/nix/issues/6895#issuecomment-2475461113
{
  pkgs,
  self,
  installables ? [ ],
}:
assert builtins.isList installables;
let
  inherit (builtins) concatMap attrValues concatStringsSep;
  inherit (pkgs.lib) unique;
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

  flakeClosure = mkFlakesClosure [ self ];

  saveFromGC = pkgs.writeScriptBin "save-from-gc" (
    concatStringsSep "\n" (flakeClosure ++ installables) + "\n"
  );
in
saveFromGC
