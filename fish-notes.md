# Fish Shell Notes for WASM AudioWorklet Project

This project uses fish shell for command-line scripts. Here are some important differences between bash and fish that are relevant to our scripts:

## Syntax Differences

1. **Conditionals**: 
   - Fish: `if not command -v cargo > /dev/null`
   - Bash: `if ! command -v cargo &> /dev/null`

2. **String Comparison**:
   - Fish: `string match -q "*pattern*" $variable`
   - Bash: `[[ $variable == *"pattern"* ]]`

3. **Variable Scope**:
   - Variables in fish are block-scoped
   - Variables in bash are function-scoped

4. **Command Substitution**:
   - Fish: `(command)`
   - Bash: `$(command)`

5. **No undefined variables**:
   - Fish throws an error on undefined variables
   - You must define all variables before use

## Compilation Workflow

1. Use `./compile-wasm.fish` to compile Rust to WebAssembly
2. Equivalent bash script is provided as `./compile-wasm.sh`
3. Make sure scripts are executable with `chmod +x`

## Testing and Debugging

1. Fish output may look different from bash output
2. Use `fish --command "echo $status"` to check exit codes
3. For debugging, fish provides the `fish_trace` feature:
   ```fish
   set -l fish_trace 1
   ./compile-wasm.fish
   ```

## Environment Setup

If using fish shell, make sure your PATH and environment variables are correctly set in your `~/.config/fish/config.fish` file.

To set up Rust with fish shell:
```fish
# Add Rust to your fish shell path
set -gx PATH $HOME/.cargo/bin $PATH
```