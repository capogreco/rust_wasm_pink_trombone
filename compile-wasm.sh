#!/bin/bash
# Compile Rust to WebAssembly for the vocal tract model

set -e  # Exit on error

# Display what we're doing
echo "Compiling Rust WebAssembly for Vocal Tract model..."

# Check if cargo is installed
if ! command -v cargo &> /dev/null; then
    echo "Error: Rust/Cargo not found. Please install from https://rustup.rs/"
    exit 1
fi

# Check if wasm32 target is installed
if ! rustup target list | grep -q "wasm32-unknown-unknown (installed)"; then
    echo "Adding wasm32-unknown-unknown target..."
    rustup target add wasm32-unknown-unknown
fi

# Check if wasm-bindgen-cli is installed
if ! command -v wasm-bindgen &> /dev/null; then
    echo "Installing wasm-bindgen-cli..."
    cargo install wasm-bindgen-cli
fi

# Build using wasm-pack if available
if command -v wasm-pack &> /dev/null; then
    echo "Building with wasm-pack..."
    wasm-pack build --target web --out-dir . --no-typescript
else
    # Fallback to manual build and binding
    echo "Building with cargo and wasm-bindgen..."
    
    # Build the project
    cargo build --target wasm32-unknown-unknown --release
    
    # Generate bindings - explicitly generate both JS and WASM
    echo "Generating wasm-bindgen bindings..."
    wasm-bindgen target/wasm32-unknown-unknown/release/vocal_tract.wasm --out-dir . --target web --no-typescript
    
    # Verify files were created
    if [[ -f "vocal_tract_bg.wasm" && -f "vocal_tract.js" ]]; then
        echo "✅ Bindings generated successfully"
    else
        echo "❌ Error: Bindings not generated correctly"
        exit 1
    fi
fi

# Create a simplified version without wasm-bindgen for direct instantiation
echo "Creating simplified version for direct instantiation..."
cp -v target/wasm32-unknown-unknown/release/vocal_tract.wasm ./vocal_tract_direct.wasm

# Optimize the wasm file if wasm-opt is available
if command -v wasm-opt &> /dev/null; then
    echo "Optimizing WebAssembly with wasm-opt..."
    wasm-opt -O3 vocal_tract_bg.wasm -o vocal_tract_bg.wasm
fi

echo "Build complete! Files generated:"
ls -lh vocal_tract*

echo -e "\nTo run, start a web server in this directory with:"
echo "python -m http.server"
echo "or"
echo "npx http-server"
echo -e "\nThen open http://localhost:8000 in your browser"