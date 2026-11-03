{
  description = "ntwebterm - Web terminal using Ghostty's VT100 parser via WASM";

  inputs = {
    self.submodules = true;
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    zig-overlay.url = "github:mitchellh/zig-overlay";
    zig-overlay.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, flake-utils, zig-overlay }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [ zig-overlay.overlays.default ];
        };
        zig = pkgs.zigpkgs."0.17.0";
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.bun
            pkgs.nodejs_22
            zig
          ];
        };

        packages.default = pkgs.stdenv.mkDerivation {
          pname = "ntwebterm";
          version = "0.4.1";

          src = ./.;

          nativeBuildInputs = [ pkgs.bun pkgs.nodejs_22 zig ];

          buildPhase = ''
            export HOME=$TMPDIR
            bun install --frozen-lockfile
            bun run build
          '';

          installPhase = ''
            mkdir -p $out/dist
            cp -r dist/* $out/dist/
            cp ghostty-vt.wasm $out/
            cp package.json README.md $out/
          '';
        };
      }
    );
}
