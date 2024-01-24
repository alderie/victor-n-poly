let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}

/**
* @param {number} n
* @returns {number}
*/
export function fib(n) {
    const ret = wasm.fib(n);
    return ret >>> 0;
}

