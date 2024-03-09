{
  inputs.flakes.url = "github:deemp/flakes";
  outputs = inputs:
    let flakes = inputs.flakes; in
    flakes.makeFlake {
      inputs = {
        inherit (flakes.all) nixpkgs devshell drv-tools;
      };
      perSystem = { inputs, system }:
        let
          pkgs = inputs.nixpkgs.legacyPackages.${system};
          inherit (inputs.devshell.lib.${system}) mkCommands mkRunCommands mkRunCommandsDir mkShell;
          inherit (inputs.drv-tools.lib.${system}) writeYAML mkShellApps getExe;

          
          packages = mkShellApps {
            writeSave = writeYAML "save" "save/action.yml" (import ./action.nix { target = "save"; inherit (pkgs) lib; });
            writeRestore = writeYAML "restore" "restore/action.yml" (import ./action.nix { target = "restore"; inherit (pkgs) lib; });
            writeCache = writeYAML "cache" "action.yml" (import ./action.nix { target = "cache"; inherit (pkgs) lib; });
            writeActions = {
              text = ''
                ${getExe packages.writeSave}
                ${getExe packages.writeRestore}
                ${getExe packages.writeCache}
              '';
            };
            write = {
              runtimeInputs = [ pkgs.nodejs_20 ];
              text = ''
                ${getExe packages.writeActions}
                npm run readme
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
          devShells.default = mkShell {
            packages = [ pkgs.nodejs_20 ];
            commands = mkRunCommands "scripts" { inherit (packages) write install build; };
          };
        in
        {
          inherit packages devShells;
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
