{
  inputs.flakes.url = "github:deemp/flakes";
  outputs = inputs:
    let flakes = inputs.flakes; in
    flakes.makeFlake {
      inputs = {
        inherit (flakes.all) nixpkgs devshell;
      };
      perSystem = { inputs, system }:
        let
          pkgs = inputs.nixpkgs.legacyPackages.${system};
          inherit (inputs.devshell.lib.${system}) mkCommands mkRunCommands mkRunCommandsDir mkShell;

          tools = [ pkgs.nodejs_18 pkgs.poetry ];

          devShells.default = mkShell {
            packages = tools;
            commands =
              mkCommands "tools" tools ++
              [
                { name = "init"; command = "${pkgs.nodejs_18}/bin/npm i"; help = "install dependencies"; }
                { name = "build"; command = "NODE_OPTIONS=--openssl-legacy-provider ${pkgs.nodejs_18}/bin/npm run build"; help = "build project"; }
              ];
          };
        in
        {
          inherit devShells;
        };
    };
}
