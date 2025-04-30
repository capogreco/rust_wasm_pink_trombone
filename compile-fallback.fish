#!/usr/bin/env fish

# Compile a minimal C implementation as fallback
echo "Compiling minimal C fallback implementation..."

# Check for emcc (Emscripten compiler)
if not command -v emcc > /dev/null
    echo "Error: emcc (Emscripten compiler) not found."
    echo "Please install emscripten from https://emscripten.org/docs/getting_started/downloads.html"
    exit 1
end

# Compile the direct implementation
emcc direct-implementation.c \
    -O3 \
    -s WASM=1 \
    -s STANDALONE_WASM=1 \
    -s EXPORTED_FUNCTIONS='["_init_glottis", "_init_tract", "_set_frequency", "_set_tenseness", "_set_voiced", "_process_glottis", "_process_tract", "_get_noise_modulator", "_glottis_finish_block", "_tract_finish_block", "_set_diameter", "_set_rest_diameter", "_set_velum", "_reset_to_rest", "_add_turbulence_noise", "_get_tract_size", "_get_diameter", "_get_lip_output", "_get_nose_output"]' \
    -s EXPORTED_RUNTIME_METHODS=[] \
    -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
    --no-entry \
    -o vocal_tract_fallback.wasm

echo "Fallback compilation complete!"
echo "Generated file: vocal_tract_fallback.wasm"