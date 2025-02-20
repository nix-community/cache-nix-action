{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
    cache-nix-action = {
      url = "github:nix-community/cache-nix-action";
      flake = false;
    };
  };
  outputs =
    inputs:
    inputs.flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = inputs.nixpkgs.legacyPackages.${system};

        packages = {
          hello = pkgs.hello;

          saveFromGC = "${inputs.cache-nix-action}/saveFromGC.nix" {
            inherit pkgs;
            inherit (inputs) self;
            installables = [ packages.hello ];
          };
        };

        devShells.default = pkgs.mkShell { buildInputs = [ pkgs.gcc ]; };
      in
      {
        inherit packages devShells;
      }
    );
}
