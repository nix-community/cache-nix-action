{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    systems.url = "github:nix-systems/default";
    devshell.url = "github:deemp/devshell";
    flakes.url = "github:deemp/flakes";
    treefmt-nix.url = "github:numtide/treefmt-nix";
  };
  outputs =
    inputs:
    inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      imports = with inputs; [
        devshell.flakeModule
        treefmt-nix.flakeModule
      ];
      systems = import inputs.systems;
      perSystem =
        {
          pkgs,
          lib,
          system,
          config,
          ...
        }:
        let
          inherit (inputs.flakes.lib.${system}.drv-tools) mkShellApps;

          writeYAML =
            path: value:
            pkgs.writeShellApplication {
              name = "write";
              text = ''
                cat > ${path} <<'EOF'
                ${value}
                EOF
              '';
            };
        in
        {
          packages = mkShellApps {
            writeSave = writeYAML "save/action.yml" (
              import ./action.nix {
                target = "save";
                inherit (pkgs) lib;
              }
            );

            writeRestore = writeYAML "restore/action.yml" (
              import ./action.nix {
                target = "restore";
                inherit (pkgs) lib;
              }
            );

            writeCache = writeYAML "action.yml" (
              import ./action.nix {
                target = "cache";
                inherit (pkgs) lib;
              }
            );

            writeActions = {
              text = ''
                ${lib.getExe config.packages.writeSave}
                ${lib.getExe config.packages.writeRestore}
                ${lib.getExe config.packages.writeCache}
              '';
            };

            write = {
              runtimeInputs = [ pkgs.nodejs_20 ];
              text = ''
                ${lib.getExe config.packages.writeActions}
                npm run readme
                npm run format
              '';
              description = "write action.yml-s and tables for README-s";
            };

            install = {
              runtimeInputs = [ pkgs.nodejs_20 ];
              text = ''npm i'';
              description = "install dependencies";
            };

            build = {
              runtimeInputs = [ pkgs.nodejs_20 ];
              text = "npm run build";
              description = "build project";
            };
          };

          devshells.default = {
            packages = [ pkgs.nodejs_20 ];
            commands.scripts = [
              {
                prefix = "nix run .#";
                packages = {
                  inherit (config.packages) write install build;
                };
              }
            ];
          };

          treefmt = {
            projectRootFile = "flake.nix";
            programs.nixfmt-rfc-style.enable = true;
          };
        };
    };

  nixConfig = {
    extra-substituters = [
      "https://cache.nixos.org/"
      "https://nix-community.cachix.org"
    ];
    extra-trusted-public-keys = [
      "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
      "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="
    ];
    keep-outputs = true;
  };
}
