# https://github.com/NixOS/nix/issues/6895#issuecomment-2475461113
{
  pkgs,
  # An attrset of flake inputs.
  inputs ? { },
  # A list of paths in the `inputs` attrset to inputs that should be included.
  #
  # When empty, all `inputs` will be included.
  #
  # If non-empty, only the inputs specified in this list will be included from
  # the `inputs` attrset.
  #
  # Entries should be `/`-separated sequence of names denoting a path to an
  # input in the `inputs` attrset if `.inputs` attributes of flakes were
  # excluded from paths.
  #
  # Example:
  #
  # ```nix
  # [
  #   "devshell/nixpkgs"
  #   "devshell/flake-utils/systems"
  # ]
  # ```
  inputsInclude ? [ ],
  # Derivations list.
  #
  # Example:
  #
  # ```nix
  # [
  #   pkgs.hello
  # ]
  # ```
  derivations ? [ ],
  # Derivations attrset.
  #
  # Example:
  #
  # ```nix
  # {
  #   hello = pkgs.hello;
  # }
  # ```
  derivationsAttrs ? { },
  # Nix store paths.
  #
  # Example:
  #
  # ```nix
  # [
  #   "/nix/store/p09fxxwkdj69hk4mgddk4r3nassiryzc-hello-2.12.1"
  # ]
  # ```
  paths ? [ ],
  # Paths attrset.
  #
  # Example:
  #
  # ```nix
  # {
  #   hello = "/nix/store/p09fxxwkdj69hk4mgddk4r3nassiryzc-hello-2.12.1";
  # }
  # ```
  pathsAttrs ? { },
}:
assert builtins.isList inputsInclude;
assert builtins.isList derivations;
assert builtins.isList paths;
let
  inherit (builtins)
    concatMap
    concatStringsSep
    ;
  inherit (pkgs) lib;

  getInputsIncludeCandidates =
    inputs:
    builtins.concatLists (
      lib.mapAttrsToList (
        name: input:
        let
          go =
            prefix: flakes:
            concatMap (
              flake:
              if flake ? inputs then
                builtins.concatLists (
                  lib.mapAttrsToList (
                    name: input':
                    let
                      prefix' = "${prefix}/${name}";
                    in
                    [ prefix' ] ++ go prefix' [ input' ]
                  ) flake.inputs
                )
              else
                [ prefix ]
            ) flakes;
        in
        go name [ input ]
      ) inputs
    );

  inputsIncludeCandidates = getInputsIncludeCandidates inputs;

  getInputsIncluded =
    inputs: inputsInclude:
    lib.pipe inputsInclude [
      (builtins.map (lib.strings.splitString "/"))
      (builtins.partition (x: !(builtins.elem "" x)))
      (
        x:
        if x.wrong != [ ] then
          let
            errorMessage = lib.generators.toPretty { } (builtins.map (builtins.concatStringsSep "/") x.wrong);
          in
          throw "The paths\n\n${errorMessage}\n\ncontain empty attribute names."
        else
          x.right
      )
      (builtins.map (
        inputPath:
        {
          value = lib.attrByPath (lib.intersperse "inputs" inputPath) { } inputs;
        }
        // {
          inherit inputPath;
        }
      ))
      (builtins.partition (x: x.value != { }))
      (
        x:
        if x.wrong != [ ] then
          let
            invalidMessage = lib.generators.toPretty { } (
              builtins.map (y: builtins.concatStringsSep "/" y.inputPath) x.wrong
            );
          in
          throw "The paths\n\n${invalidMessage}\n\ndon't have corresponding inputs."
        else
          x.right
      )
      (builtins.map (x: {
        name = "${builtins.concatStringsSep "/" x.inputPath}";
        value = x.value;
      }))
      builtins.listToAttrs
    ];

  inputsIncluded = getInputsIncluded inputs (
    if inputsInclude == [ ] then inputsIncludeCandidates else inputsInclude
  );
  
  # All paths printed.
  package = pkgs.writeScript "save-from-gc" (
    concatStringsSep "\n\n" (
      lib.mapAttrsToList (name: value: "# ${name}:\n\n${lib.concatMapStringsSep "\n" (x: "- ${x}") value}") (
        let
          includeAttrset = lib.mapAttrsToList (name: value: ''"${name}": ${value}'');
        in
        {
          inherit derivations paths;
          inputs = includeAttrset inputsIncluded;
          derivationsAttrs = includeAttrset derivationsAttrs;
          pathsAttrs = includeAttrset pathsAttrs;
        }
      )
    )
  );
in
{
  inherit
    getInputsIncludeCandidates
    inputsIncludeCandidates
    getInputsIncluded
    inputsIncluded
    package
    ;
}
