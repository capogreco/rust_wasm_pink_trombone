// Direct WebAssembly implementation for minimal voice synthesis
// This provides a fallback if the Rust implementation fails

#include <math.h>
#include <stdint.h>
#include <emscripten.h>

#define PI 3.14159265358979323846

// Simple oscillator state
static float phase = 0;
static float frequency = 140;
static float tenseness = 0.6;
static int is_voiced = 1;

// Initialize the system
EMSCRIPTEN_KEEPALIVE
void init_glottis(float sample_rate) {
    // Nothing to initialize in this minimal version
    phase = 0;
}

EMSCRIPTEN_KEEPALIVE
void init_tract(float sample_rate) {
    // Tract not implemented in minimal version
}

// Set frequency parameter
EMSCRIPTEN_KEEPALIVE
void set_frequency(float freq) {
    frequency = freq;
}

// Set tenseness parameter
EMSCRIPTEN_KEEPALIVE
void set_tenseness(float tense) {
    tenseness = tense;
}

// Set voiced state
EMSCRIPTEN_KEEPALIVE
void set_voiced(int voiced) {
    is_voiced = voiced;
}

// Process one sample of glottal source
EMSCRIPTEN_KEEPALIVE
float process_glottis(float noise_source) {
    if (!is_voiced) {
        return noise_source * 0.1f;
    }
    
    // Simple sine oscillator with frequency modulation
    float output = sinf(phase) * tenseness;
    
    // Update phase
    phase += 2.0f * PI * frequency / 44100.0f;
    while (phase >= 2.0f * PI) {
        phase -= 2.0f * PI;
    }
    
    return output;
}

// Process one sample of tract model
EMSCRIPTEN_KEEPALIVE
float process_tract(float glottal_output, float turbulence_noise, float lambda) {
    // Simplified model: just apply a basic resonance to the glottal output
    return glottal_output * 0.8f;
}

// Get noise modulator
EMSCRIPTEN_KEEPALIVE
float get_noise_modulator() {
    return 0.5f;
}

// End of block processing
EMSCRIPTEN_KEEPALIVE
void glottis_finish_block() {
    // Nothing to do in minimal version
}

EMSCRIPTEN_KEEPALIVE
void tract_finish_block(float block_time) {
    // Nothing to do in minimal version
}

// Dummy tract shape functions
EMSCRIPTEN_KEEPALIVE
void set_diameter(int index, float diameter) {
    // No-op in minimal version
}

EMSCRIPTEN_KEEPALIVE
void set_rest_diameter(int index, float diameter) {
    // No-op in minimal version
}

EMSCRIPTEN_KEEPALIVE
void set_velum(float velum_target) {
    // No-op in minimal version
}

EMSCRIPTEN_KEEPALIVE
void reset_to_rest() {
    // No-op in minimal version
}

EMSCRIPTEN_KEEPALIVE
void add_turbulence_noise(float turbulence_noise, float index, float diameter, float noise_modulator) {
    // No-op in minimal version
}

EMSCRIPTEN_KEEPALIVE
int get_tract_size() {
    return 44;
}

EMSCRIPTEN_KEEPALIVE
float get_diameter(int index) {
    return 1.5f;
}

EMSCRIPTEN_KEEPALIVE
float get_lip_output() {
    return 0.0f;
}

EMSCRIPTEN_KEEPALIVE
float get_nose_output() {
    return 0.0f;
}