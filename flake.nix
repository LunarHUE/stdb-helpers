{
  description = "Website dev environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };
      in
      {
        devShells.default = pkgs.mkShell {
          name = "website-dev";

          packages = with pkgs; [
            nodejs_20
            bun
            watchexec
          ];
          shellHook = ''
            export PATH=$PATH:$(pwd)/node_modules/.bin
            bun add -g turbo
          '';
        };
      }
    );
}
