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

          tools = [ pkgs.nodejs_18 pkgs.poetry ];

          packages = mkShellApps {
            writeSave = writeYAML "save" "save/action.yml" (import ./action.nix { target = "save"; inherit (pkgs) lib; });
            writeRestore = writeYAML "restore" "restore/action.yml" (import ./action.nix { target = "restore"; inherit (pkgs) lib; });
            writeCache = writeYAML "cache" "action.yml" (import ./action.nix { target = "cache"; inherit (pkgs) lib; });
            write = {
              runtimeInputs = [ pkgs.poetry ];
              text = ''
                ${getExe packages.writeSave}
                ${getExe packages.writeRestore}
                ${getExe packages.writeCache}

                poetry run translate_table
              '';

              description = "write action.yml-s and tables for README-s";
            };
            install = {
              runtimeInputs = [ pkgs.nodejs pkgs.poetry ];
              text = ''
                npm i
                poetry install
              '';
              description = "install dependencies";
            };
            build = {
              runtimeInputs = [ pkgs.nodejs ];
              text = "npm run build";
              description = "build project";
            };
          };
          devShells.default = mkShell {
            packages = tools;
            commands = mkRunCommands "scripts" { inherit (packages) write install build; };
          };
        in
        {
          inherit packages devShells;
        };
    };
}
