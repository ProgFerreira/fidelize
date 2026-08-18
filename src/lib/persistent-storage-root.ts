import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Diretório estável pra guardar arquivos que precisam sobreviver a
 * redeploys (gravações de videochamada, comprovantes de afiliado etc.).
 *
 * Na Hostinger, `process.cwd()` é a pasta versionada do build
 * (`hbuilds/versions/<id>/nodejs`) — efêmera, recriada a cada deploy. A
 * raiz do domínio (onde fica o `hostinger.env`) não muda. Sobe até achar
 * `hostinger.env`/`fidelize.env`; se não achar (dev local, CI), usa
 * `process.cwd()` mesmo — mesma estratégia de `src/lib/load-env.ts`.
 */
export function persistentStorageRoot(): string {
  const names = ["hostinger.env", "fidelize.env"];
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    for (const name of names) {
      if (existsSync(join(dir, name))) return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}
