use std::f32::consts::PI;

// Constants
const WAVEFORM_LENGTH: usize = 64;

pub struct Glottis {
    sample_rate: f32,
    time_in_waveform: f32,
    frequency: f32,
    tenseness: f32,
    is_voiced: bool,
    intensity: f32,
    loudness: f32,
    vibrato_amount: f32,
    vibrato_frequency: f32,
    vibrato_phase: f32,
    
    // Waveform state
    waveform: [f32; WAVEFORM_LENGTH],
    
    // Derived parameters
    alpha: f32,
    e0: f32,
    epsilon: f32,
    shift: f32,
    delta: f32,
    
    // Noise modulation
    noise_modulator: f32,
    
    // Performance optimization
    time_step: f32,
}

impl Glottis {
    pub fn new(sample_rate: f32) -> Self {
        let mut glottis = Glottis {
            sample_rate,
            time_in_waveform: 0.0,
            frequency: 140.0,  // Default F0, Hz
            tenseness: 0.6,    // Default voice tenseness
            is_voiced: true,   // Default to voiced
            intensity: 0.0,    // Current intensity
            loudness: 1.0,     // Volume multiplier
            vibrato_amount: 0.005,   // Slight vibrato
            vibrato_frequency: 6.0,  // Hz
            vibrato_phase: 0.0,      // Radians
            
            // Initialize waveform with zeros
            waveform: [0.0; WAVEFORM_LENGTH],
            
            // Derived parameters will be calculated in setup_waveform
            alpha: 0.0,
            e0: 0.0,
            epsilon: 0.0,
            shift: 0.0,
            delta: 0.0,
            
            // Initialize noise modulator
            noise_modulator: 0.0,
            
            // Performance optimization
            time_step: 1.0 / sample_rate,
        };
        
        // Initial waveform setup
        glottis.setup_waveform();
        
        glottis
    }
    
    pub fn set_frequency(&mut self, frequency: f32) {
        // Clamp to reasonable range
        self.frequency = frequency.clamp(50.0, 500.0);
    }
    
    pub fn set_tenseness(&mut self, tenseness: f32) {
        // Clamp to [0, 1]
        self.tenseness = tenseness.clamp(0.0, 1.0);
        
        // Update waveform with new tenseness value
        self.setup_waveform();
    }
    
    pub fn set_voiced(&mut self, voiced: bool) {
        self.is_voiced = voiced;
    }
    
    pub fn get_noise_modulator(&self) -> f32 {
        self.noise_modulator
    }
    
    pub fn finish_block(&mut self) {
        // Nothing to do for now, but could update internals if needed
    }

    // Process the glottis model for one sample
    pub fn process(&mut self, noise_source: f32) -> f32 {
        // Apply vibrato to frequency
        self.vibrato_phase += self.vibrato_frequency * 2.0 * PI * self.time_step;
        if self.vibrato_phase > 2.0 * PI {
            self.vibrato_phase -= 2.0 * PI;
        }
        
        let vibrato = self.vibrato_amount * self.tenseness * f32::sin(self.vibrato_phase);
        let target_frequency = self.frequency * (1.0 + vibrato);
        
        // Determine whether to use voiced or unvoiced excitation
        if self.is_voiced {
            // Get normalized position in waveform (0 to 1)
            let normalized_position = self.time_in_waveform / WAVEFORM_LENGTH as f32;
            
            // Interpolate the waveform for smooth output
            let position_in_waveform = normalized_position * WAVEFORM_LENGTH as f32;
            let lower_index = position_in_waveform as usize % WAVEFORM_LENGTH;
            let upper_index = (lower_index + 1) % WAVEFORM_LENGTH;
            let alpha = position_in_waveform - position_in_waveform.floor();
            
            // Linear interpolation of waveform values
            let lower_value = self.waveform[lower_index];
            let upper_value = self.waveform[upper_index];
            let glottal_output = lower_value * (1.0 - alpha) + upper_value * alpha;
            
            // Advance time in waveform
            self.time_in_waveform += target_frequency * WAVEFORM_LENGTH as f32 * self.time_step;
            while self.time_in_waveform >= WAVEFORM_LENGTH as f32 {
                self.time_in_waveform -= WAVEFORM_LENGTH as f32;
            }
            
            // Set noise modulator based on waveform position
            // Make noise louder during the open phase of the glottis
            self.noise_modulator = 0.1 + 0.2 * f32::max(0.0, f32::sin(PI * 2.0 * normalized_position));
            
            glottal_output * self.loudness
        } else {
            // Unvoiced excitation (pure noise)
            let unvoiced_noise = noise_source * 0.1;
            self.noise_modulator = 1.0;
            unvoiced_noise
        }
    }
    
    // Calculate waveform parameters and construct the glottal waveform
    fn setup_waveform(&mut self) {
        // Calculate derived parameters from tenseness
        self.intensity = 1.0;
        
        // Ranged parameters that depend on tenseness
        let rd = 3.0 * (1.0 - self.tenseness);
        self.alpha = rd / 100.0;  // Open quotient
        self.e0 = -1.0 / self.alpha;  // Related to pulse skewness
        
        // Return phase delay
        let rap = -1.0 / (4.0 * rd);
        let rk = 0.5 + 1.2 * rap;  // Approximation
        
        // Timing parameters
        let ta = rd;  // Time constant for opening phase
        
        // Calculate waveform-related parameters
        self.epsilon = 1.0 / self.intensity;
        self.shift = f32::exp(-self.epsilon * (1.0 - self.tenseness) * PI);
        self.delta = 1.0 - self.shift;
        
        // Generate the waveform
        for i in 0..WAVEFORM_LENGTH {
            let t = i as f32 / WAVEFORM_LENGTH as f32;
            
            // Normalized time from 0 to 1
            let mut output = if t < self.alpha {
                // First segment: exponential increase
                self.e0 * f32::exp(self.epsilon * (t / self.alpha) * PI) - self.e0
            } else {
                // Second segment: direct current component
                (-f32::exp(-self.epsilon * (t - self.alpha) / (1.0 - self.alpha) * PI) + self.shift) / self.delta
            };
            
            // Apply tenseness modulation
            output *= self.intensity * self.tenseness;
            
            // Fast sigmoid-like limiting for stability
            if output > 1.0 { output = 1.0; }
            if output < -1.0 { output = -1.0; }
            
            self.waveform[i] = output;
        }
    }
}