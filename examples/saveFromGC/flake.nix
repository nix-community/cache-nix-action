{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/def3da69945bbe338c373fddad5a1bb49cf199ce";
    flake-utils = {
      url = "github:numtide/flake-utils";
      inputs.systems.follows = "systems";
    };
    cache-nix-action = {
      url = "github:nix-community/cache-nix-action";
      flake = false;
    };
    systems.url = "github:nix-systems/default";
  };
  outputs =
    inputs:
    inputs.flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = inputs.nixpkgs.legacyPackages.${system};

        packages = {
          hello = pkgs.hello;

          inherit
            (import "${inputs.cache-nix-action}/saveFromGC.nix" {
              inherit pkgs inputs;
              inputsExclude = [
                # the systems input will still be saved
                # because flake-utils needs it
                inputs.systems
              ];
              derivations = [
                packages.hello
                devShells.default
              ];
              paths = [ "${packages.hello}/bin/hello" ];
            })
            saveFromGC
            ;
        };

        devShells.default = pkgs.mkShell { buildInputs = [ pkgs.gcc ]; };
      in
      {
        inherit packages devShells;
      }
    );
}
