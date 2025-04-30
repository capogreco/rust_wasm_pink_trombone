#!/usr/bin/env fish

# Compile an ultra-minimal C implementation with no imports
echo "Compiling ultra-minimal implementation with no imports..."

# Check for emcc (Emscripten compiler)
if not command -v emcc > /dev/null
    echo "Error: emcc (Emscripten compiler) not found."
    echo "Please install emscripten from https://emscripten.org/docs/getting_started/downloads.html"
    exit 1
end

# Compile the ultra-minimal implementation
emcc ultra-minimal.c \
    -O3 \
    -s WASM=1 \
    -s STANDALONE_WASM=1 \
    -s TOTAL_MEMORY=65536 \
    -s IMPORTED_MEMORY=0 \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s EXPORT_NAME=UltraMinimalModule \
    -s ENVIRONMENT=web \
    -s EXPORTED_FUNCTIONS='["_malloc", "_free", "_init_glottis", "_init_tract", "_set_frequency", "_set_tenseness", "_set_voiced", "_process_glottis", "_process_tract", "_get_noise_modulator", "_glottis_finish_block", "_tract_finish_block", "_set_diameter", "_set_rest_diameter", "_set_velum", "_reset_to_rest", "_add_turbulence_noise", "_get_tract_size", "_get_diameter", "_get_lip_output", "_get_nose_output"]' \
    -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
    -s ALLOW_MEMORY_GROWTH=0 \
    -s MALLOC=emmalloc \
    -s MINIMAL_RUNTIME=1 \
    -s ASSERTIONS=0 \
    -s DISABLE_EXCEPTION_CATCHING=1 \
    -s NO_FILESYSTEM=1 \
    --no-entry \
    -o ultra-minimal.wasm

echo "Ultra-minimal compilation complete!"
echo "Generated file: ultra-minimal.wasm"