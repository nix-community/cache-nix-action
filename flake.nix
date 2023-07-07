{
  inputs = {
    flakes = {
      url = "github:deemp/flakes";
    };
  };
  outputs = inputsTop:
    let
      inputs_ =
        let flakes = inputsTop.flakes.flakes; in
        {
          inherit (flakes.source-flake) nixpkgs flake-utils;
          inherit (flakes) devshell;
        };

      outputs = flake { } // { inherit flake; inputs = inputs_; };

      flake = inputs__:
        let inputs = inputs_ // inputs__; in
        inputs.flake-utils.lib.eachDefaultSystem
          (system:
            let
              pkgs = inputs.nixpkgs.legacyPackages.${system};
              inherit (inputs.devshell.lib.${system}) mkCommands mkRunCommands mkRunCommandsDir mkShell;

              tools = [ pkgs.nodejs_18 ];

              devShells.default = mkShell {
                packages = tools;
                bash.extra = "export NODE_OPTIONS=--openssl-legacy-provider";
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
            });
    in
    outputs;
}
