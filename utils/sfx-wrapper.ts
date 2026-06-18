import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { Base91 } from "@hpcc-js/wasm-base91";
import { Zstd } from "@hpcc-js/wasm-zstd";
import type { Plugin, PluginBuild } from "esbuild";

function tpl(wasmJsPath: string, base91Wasm: string, base91CompressedWasm: string) {

    const compressed = (base91CompressedWasm.length + 8 * 1024) <= base91Wasm.length;

    return `\
import { decode, instantiateModule } from "@hpcc-js/wasm-runtime";

const blobStr = '${compressed ? base91CompressedWasm : base91Wasm}';

let g_module: Promise<any> | undefined;
let g_wasmBinary: Uint8Array | undefined;
export default function() {
    if (!g_wasmBinary) {
        g_wasmBinary = ${compressed ? "decompress(decode(blobStr))" : "decode(blobStr)"};
    }

    if (!g_module) {
        g_module = instantiateModule(g_wasmBinary);
    }
    return g_module;
}

export function reset() {
    if (g_module) {
        g_module = undefined;
    }
} `.trim();
}

export async function wrap(path: string) {
    const base91 = await Base91.load();
    const zstd = await Zstd.load();

    const wasm = await readFile(path);
    path = path.replace(/\.js$/, ".xxx");
    const wasmJsPath = path.replace(/\.wasm$/, ".js");
    const base91Wasm = base91.encode(wasm);
    const compressedWasm = zstd.compress(wasm);
    const base91CompressedWasm = base91.encode(compressedWasm);

    return tpl(wasmJsPath, base91Wasm, base91CompressedWasm);
}

export function sfxWasm(): Plugin {
    return {
        name: "sfx-wasm",

        setup(build: PluginBuild) {

            build.onLoad({ filter: /\.wasm$/ }, async args => {
                return {
                    contents: await wrap(args.path),
                    loader: "ts",
                };
            });
        }
    };
}
