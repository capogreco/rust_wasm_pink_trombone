/* tslint:disable */
/* eslint-disable */
export function init_glottis(sample_rate: number): void;
export function set_frequency(frequency: number): void;
export function set_tenseness(tenseness: number): void;
export function set_voiced(voiced: boolean): void;
export function process_glottis(noise_source: number): number;
export function get_noise_modulator(): number;
export function glottis_finish_block(): void;
export function init_tract(sample_rate: number): void;
export function free_tract(): void;
export function process_tract(glottal_output: number, turbulence_noise: number, lambda: number): number;
export function tract_finish_block(block_time: number): void;
export function set_diameter(index: number, diameter: number): void;
export function set_rest_diameter(index: number, diameter: number): void;
export function set_velum(velum_target: number): void;
export function reset_to_rest(): void;
export function add_turbulence_noise(turbulence_noise: number, index: number, diameter: number, noise_modulator: number): void;
export function get_tract_size(): number;
export function get_diameter(index: number): number;
export function get_lip_output(): number;
export function get_nose_output(): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly init_glottis: (a: number) => void;
  readonly set_frequency: (a: number) => void;
  readonly set_tenseness: (a: number) => void;
  readonly set_voiced: (a: number) => void;
  readonly process_glottis: (a: number) => number;
  readonly get_noise_modulator: () => number;
  readonly glottis_finish_block: () => void;
  readonly init_tract: (a: number) => void;
  readonly free_tract: () => void;
  readonly process_tract: (a: number, b: number, c: number) => number;
  readonly tract_finish_block: (a: number) => void;
  readonly set_diameter: (a: number, b: number) => void;
  readonly set_rest_diameter: (a: number, b: number) => void;
  readonly set_velum: (a: number) => void;
  readonly reset_to_rest: () => void;
  readonly add_turbulence_noise: (a: number, b: number, c: number, d: number) => void;
  readonly get_tract_size: () => number;
  readonly get_diameter: (a: number) => number;
  readonly get_lip_output: () => number;
  readonly get_nose_output: () => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_3: WebAssembly.Table;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
