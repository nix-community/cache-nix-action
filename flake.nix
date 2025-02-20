{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    systems.url = "github:nix-systems/default";
    devshell.url = "github:deemp/devshell";
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
          mkShellApps = lib.mapAttrs (
            name: value:
            if !(lib.isDerivation value) && lib.isAttrs value then
              pkgs.writeShellApplication (value // { inherit name; })
            else
              value
          );

          writeYAML =
            path: value:
            pkgs.writeShellApplication {
              name = "write";
              text = ''
                mkdir -p "$(dirname ${path})"
                cat > ${path} <<'EOF'
                ${value}
                EOF
              '';
            };
            
          nodejs = pkgs.nodejs_23;
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
              runtimeInputs = [ nodejs pkgs.mdsh ];
              text = ''
                ${lib.getExe config.packages.writeActions}
                mdsh -i README.md --work_dir examples/saveFromGC
                npm run readme
                npm run format
              '';
              meta.description = "write action.yml-s and README-s";
            };

            writeBuildjetCI = writeYAML ".github/workflows/buildjet-ci.yaml" (
              import ./nix/ci.nix { backend = "buildjet"; inherit lib; }
            );

            writeActionsCI = writeYAML ".github/workflows/ci.yaml" (
              import ./nix/ci.nix { backend = "actions"; inherit lib; }
            );

            writeCI = {
              text = ''
                ${lib.getExe config.packages.writeBuildjetCI}
                ${lib.getExe config.packages.writeActionsCI}
                npm run format-ci
              '';
              meta.description = "write CI files";
            };

            install = {
              runtimeInputs = [ nodejs ];
              text = ''npm i'';
              meta.description = "install dependencies";
            };

            build = {
              runtimeInputs = [ nodejs ];
              text = "npm run build";
              meta.description = "build project";
            };
          }
          // {
            saveFromGC = import ./saveFromGC.nix {
              inherit pkgs;
              inherit (inputs) self;
              installables = [ config.packages.build ];
            };
          };

          devshells.default = {
            packages = [ nodejs pkgs.mdsh ];
            commands.scripts = [
              {
                prefix = "nix run .#";
                packages = {
                  inherit (config.packages) write install build writeCI;
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
