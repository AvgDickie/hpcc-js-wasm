// POC shared wasm runtime for hpcc-js-wasm
// Exports: decode(raw:string):Uint8Array and instantiateModule(wasmBinary:Uint8Array, wrapper?:any):Promise<any>

export const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"';

export function decode(raw) {
    const len = raw.length;
    const ret = [];

    let b = 0;
    let n = 0;
    let v = -1;

    for (let i = 0; i < len; i++) {
        const p = table.indexOf(raw[i]);
        if (p === -1) continue;
        if (v < 0) {
            v = p;
        } else {
            v += p * 91;
            b |= v << n;
            n += (v & 8191) > 88 ? 13 : 14;
            do {
                ret.push(b & 0xff);
                b >>= 8;
                n -= 8;
            } while (n > 7);
            v = -1;
        }
    }

    if (v > -1) {
        ret.push((b | v << n) & 0xff);
    }

    return new Uint8Array(ret);
}

export async function instantiateModule(wasmBinary, wrapper) {
    // If the compiled target provides a wrapper function (emscripten modularized output), call it.
    try {
        if (wrapper && typeof wrapper === 'function') {
            // wrapper may return a Module-like object or a Promise
            const mod = wrapper({ wasmBinary, locateFile: (name) => "sfx-wrapper nop" });
            return Promise.resolve(mod);
        }
    } catch (e) {
        // fall through to direct instantiation
    }

    // Fallback: instantiate using the WebAssembly API
    const res = await WebAssembly.instantiate(wasmBinary, {});
    // WebAssembly.instantiate may return { module, instance } or a Module namespace depending on environment
    if (res && res.instance) return res.instance.exports || res.instance;
    return res;
}
