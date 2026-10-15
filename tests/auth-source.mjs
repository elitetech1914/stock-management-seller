import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const nativeRequire = createRequire(import.meta.url);
export function loadSource(relative, substitutions = {}) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const compiledModule = { exports: {} }; cache.set(filename, compiledModule);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    function localRequire(name) {
      if (Object.hasOwn(substitutions, name)) return substitutions[name];
      if (name === "server-only") return {};
      if (name.startsWith("@/") || name.startsWith(".")) {
        const base = name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : path.resolve(path.dirname(filename), name);
        return load(existsSync(base + ".ts") ? base + ".ts" : base + ".tsx");
      }
      return nativeRequire(name);
    }
    new Function("require", "module", "exports", source)(localRequire, compiledModule, compiledModule.exports);
    return compiledModule.exports;
  }
  return load(path.join(root, relative));
}
