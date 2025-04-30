/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const init_glottis: (a: number) => void;
export const set_frequency: (a: number) => void;
export const set_tenseness: (a: number) => void;
export const set_voiced: (a: number) => void;
export const process_glottis: (a: number) => number;
export const get_noise_modulator: () => number;
export const glottis_finish_block: () => void;
export const init_tract: (a: number) => void;
export const free_tract: () => void;
export const process_tract: (a: number, b: number, c: number) => number;
export const tract_finish_block: (a: number) => void;
export const set_diameter: (a: number, b: number) => void;
export const set_rest_diameter: (a: number, b: number) => void;
export const set_velum: (a: number) => void;
export const reset_to_rest: () => void;
export const add_turbulence_noise: (a: number, b: number, c: number, d: number) => void;
export const get_tract_size: () => number;
export const get_diameter: (a: number) => number;
export const get_lip_output: () => number;
export const get_nose_output: () => number;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __wbindgen_export_3: WebAssembly.Table;
export const __wbindgen_start: () => void;
