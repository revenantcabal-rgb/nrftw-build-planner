import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

export interface BuildState {
  name: string;
  weapon?: string;
  offhand?: string;
  head?: string;
  chest?: string;
  hands?: string;
  legs?: string;
  ring1?: string;
  ring2?: string;
  ring3?: string;
}

export function encodeBuild(build: BuildState): string {
  const json = JSON.stringify(build);
  return compressToEncodedURIComponent(json);
}

export function decodeBuild(hash: string): BuildState | null {
  try {
    const json = decompressFromEncodedURIComponent(hash);
    if (!json) return null;
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getBuildFromUrl(): BuildState | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash || !hash.startsWith("#b=")) return null;
  return decodeBuild(hash.slice(3));
}

export function setBuildInUrl(build: BuildState): void {
  const encoded = encodeBuild(build);
  window.history.replaceState(null, "", `#b=${encoded}`);
}
