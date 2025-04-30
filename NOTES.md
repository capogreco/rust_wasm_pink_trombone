# Important Implementation Notes

## Project Focus
- ONLY use Rust for WebAssembly generation
- NO fallbacks to C or other languages
- The purpose is to assess the viability of Rust → WASM → AudioWorklet workflow
- Fallbacks defeat this purpose by obscuring whether Rust is viable

## Compilation
- Use `compile-wasm.fish` for WebAssembly compilation 
- Do NOT use any C-based compilation scripts

## UI Requirements
- All HTML should use dark mode styling
- Audio visualization should be visible on dark backgrounds

## Diagnosing Issues
- When debugging WebAssembly issues, focus on fixing the Rust implementation
- Address import errors by properly configuring the importObject in the AudioWorklet
- Trace the actual generated imports from wasm-bindgen to identify required fields

## Dependencies
- Rely only on Rust stdlib and wasm-bindgen
- Avoid any runtime dependency on Emscripten

## Testing Strategy
- Test the pure Rust implementation only
- Report specific failures with the Rust-based approach
- Do not silently fall back to alternative implementations