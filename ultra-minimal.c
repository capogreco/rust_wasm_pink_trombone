// Ultra-minimal WebAssembly implementation that requires no imports
// This provides a last-resort fallback if all other approaches fail

#include <stdint.h>

// Simple oscillator state
static double phase = 0;
static double frequency = 440;

// Initialize with no dependencies
__attribute__((export_name("init_glottis")))
void init_glottis(float sample_rate) {
    phase = 0;
}

__attribute__((export_name("init_tract")))
void init_tract(float sample_rate) {
    // Nothing to do
}

// Simple sine approximation that doesn't use any imports
__attribute__((export_name("fast_sin")))
double fast_sin(double x) {
    // Map x to range [0, 4)
    double y = (x / 6.28318530718) * 4.0;
    y = y - (int)y;
    
    // Triangle wave approximation
    if (y < 1) return y;
    if (y < 2) return 2 - y;
    if (y < 3) return y - 2 - 1;
    return 1 - (y - 3);
}

// Set frequency parameter
__attribute__((export_name("set_frequency")))
void set_frequency(float freq) {
    frequency = freq;
}

// Set tenseness parameter (ignored)
__attribute__((export_name("set_tenseness")))
void set_tenseness(float tense) {
    // Ignored
}

// Set voiced state (ignored)
__attribute__((export_name("set_voiced")))
void set_voiced(int voiced) {
    // Ignored
}

// Process one sample of glottal source
__attribute__((export_name("process_glottis")))
float process_glottis(float noise_source) {
    // Simple oscillator that doesn't use any imports
    double output = fast_sin(phase) * 0.5;
    
    // Update phase
    phase += 2.0 * 3.14159 * frequency / 44100.0;
    while (phase >= 2.0 * 3.14159) {
        phase -= 2.0 * 3.14159;
    }
    
    return (float)output;
}

// Process one sample of tract model
__attribute__((export_name("process_tract")))
float process_tract(float glottal_output, float turbulence_noise, float lambda) {
    // Just pass through the glottal output
    return glottal_output;
}

// Get noise modulator
__attribute__((export_name("get_noise_modulator")))
float get_noise_modulator() {
    return 0.5f;
}

// End of block processing
__attribute__((export_name("glottis_finish_block")))
void glottis_finish_block() {
    // Nothing to do
}

__attribute__((export_name("tract_finish_block")))
void tract_finish_block(float block_time) {
    // Nothing to do
}

// Dummy tract shape functions
__attribute__((export_name("set_diameter")))
void set_diameter(int index, float diameter) {
    // No-op
}

__attribute__((export_name("set_rest_diameter")))
void set_rest_diameter(int index, float diameter) {
    // No-op
}

__attribute__((export_name("set_velum")))
void set_velum(float velum_target) {
    // No-op
}

__attribute__((export_name("reset_to_rest")))
void reset_to_rest() {
    // No-op
}

__attribute__((export_name("add_turbulence_noise")))
void add_turbulence_noise(float turbulence_noise, float index, float diameter, float noise_modulator) {
    // No-op
}

__attribute__((export_name("get_tract_size")))
int get_tract_size() {
    return 44;
}

__attribute__((export_name("get_diameter")))
float get_diameter(int index) {
    return 1.5f;
}

__attribute__((export_name("get_lip_output")))
float get_lip_output() {
    return 0.0f;
}

__attribute__((export_name("get_nose_output")))
float get_nose_output() {
    return 0.0f;
}