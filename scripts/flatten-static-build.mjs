// Keep only the static site in dist/: drop the server bundle and lift dist/client/* up one level.
import { cpSync, existsSync, rmSync } from "node:fs";

if (existsSync("dist/client")) {
  rmSync("dist/server", { recursive: true, force: true });
  cpSync("dist/client", "dist", { recursive: true });
  rmSync("dist/client", { recursive: true, force: true });
}
