use std::f32::consts::PI;

// Constants
const MAX_TRANSIENTS: usize = 20;

// Transient structure for plosives
struct Transient {
    position: usize,     // Position in tract
    time_alive: f32,     // How long the transient has existed
    life_time: f32,      // When to remove this transient
    strength: f32,       // Amplitude scaling
    exponent: f32,       // Decay exponent
    is_active: bool,     // Is this transient active
}

impl Transient {
    fn new(position: usize) -> Self {
        Transient {
            position,
            time_alive: 0.0,
            life_time: 0.2,
            strength: 0.3,
            exponent: 200.0,
            is_active: true,
        }
    }
}

pub struct Tract {
    // Configuration
    sample_rate: f32,
    n: usize,                  // Number of tube sections
    nose_length: usize,        // Number of nose sections
    nose_start: usize,         // Offset of the nose from the main tract
    blade_start: usize,        // Start of the blade
    tip_start: usize,          // Start of the tip
    lip_start: usize,          // Start of the lips
    
    // Tube state
    r: Vec<f32>,               // Right-going wave components
    l: Vec<f32>,               // Left-going wave components
    reflection: Vec<f32>,      // Reflection coefficients
    new_reflection: Vec<f32>,  // Next step reflection coefficients
    junction_output_r: Vec<f32>, // R output from junction
    junction_output_l: Vec<f32>, // L output from junction
    diameter: Vec<f32>,        // Tract diameters
    rest_diameter: Vec<f32>,   // Rest diameters
    target_diameter: Vec<f32>, // Target diameters
    a: Vec<f32>,               // Cross-sectional areas

    // Nose state
    nose_r: Vec<f32>,          // Right-going wave components (nose)
    nose_l: Vec<f32>,          // Left-going wave components (nose)
    nose_reflection: Vec<f32>, // Reflection coefficients (nose)
    nose_junction_output_r: Vec<f32>, // R output from nose junction
    nose_junction_output_l: Vec<f32>, // L output from nose junction
    nose_diameter: Vec<f32>,   // Nose diameters
    nose_a: Vec<f32>,          // Nose cross-sectional areas
    
    // Junction with the nose
    reflection_left: f32,      // Reflectivity at nose junction (left)
    reflection_right: f32,     // Reflectivity at nose junction (right)
    reflection_nose: f32,      // Reflectivity at nose junction (nose)
    new_reflection_left: f32,  // Next step reflectivity at nose junction (left)
    new_reflection_right: f32, // Next step reflectivity at nose junction (right)
    new_reflection_nose: f32,  // Next step reflectivity at nose junction (nose)
    
    // Glottal and lip reflections
    glottal_reflection: f32,   // Reflectivity at the glottis
    pub lip_reflection: f32,       // Reflectivity at the lips
    
    // Movement
    movement_speed: f32,       // Speed of tract changes in cm/second
    velum_target: f32,         // Target velum opening
    
    // Transients for stop consonants
    transients: Vec<Transient>,
    n_transients: usize,       // Number of active transients
    last_obstruction: Option<usize>, // Index of last obstruction for generating transients
    
    // Output signals
    pub lip_output: f32,           // Output from the mouth
    pub nose_output: f32,          // Output from the nose
    
    // Utility
    fade: f32,                 // Damping of reflections
}

impl Tract {
    pub fn new(sample_rate: f32) -> Self {
        // Default configuration
        let n = 44;
        let blade_start = 10;
        let tip_start = 32;
        let lip_start = 39;
        let nose_length = (28.0 * n as f32 / 44.0) as usize;
        let nose_start = n - nose_length + 1;
        
        // Create empty transients vector with capacity
        let mut transients = Vec::with_capacity(MAX_TRANSIENTS);
        
        // Initialize with empty transients
        for _ in 0..MAX_TRANSIENTS {
            transients.push(Transient {
                position: 0,
                time_alive: 0.0,
                life_time: 0.0,
                strength: 0.0,
                exponent: 0.0,
                is_active: false,
            });
        }
        
        // Initialize vectors with zeros
        let mut tract = Tract {
            sample_rate,
            n,
            nose_length,
            nose_start,
            blade_start,
            tip_start,
            lip_start,
            
            // Initialize main tract arrays
            r: vec![0.0; n],
            l: vec![0.0; n],
            reflection: vec![0.0; n + 1],
            new_reflection: vec![0.0; n + 1],
            junction_output_r: vec![0.0; n + 1],
            junction_output_l: vec![0.0; n + 1],
            diameter: vec![0.0; n],
            rest_diameter: vec![0.0; n],
            target_diameter: vec![0.0; n],
            a: vec![0.0; n],
            
            // Initialize nose arrays
            nose_r: vec![0.0; nose_length],
            nose_l: vec![0.0; nose_length],
            nose_reflection: vec![0.0; nose_length + 1],
            nose_junction_output_r: vec![0.0; nose_length + 1],
            nose_junction_output_l: vec![0.0; nose_length + 1],
            nose_diameter: vec![0.0; nose_length],
            nose_a: vec![0.0; nose_length],
            
            // Initialize reflections
            reflection_left: 0.0,
            reflection_right: 0.0,
            reflection_nose: 0.0,
            new_reflection_left: 0.0,
            new_reflection_right: 0.0,
            new_reflection_nose: 0.0,
            
            // Set default reflections
            glottal_reflection: 0.75,
            lip_reflection: -0.85,
            
            // Movement parameters
            movement_speed: 15.0, // cm per second
            velum_target: 0.01,   // Mostly closed
            
            // Transient state
            transients,
            n_transients: 0,
            last_obstruction: None,
            
            // Output values
            lip_output: 0.0,
            nose_output: 0.0,
            
            // Utility
            fade: 1.0,
        };
        
        // Set up default tract shape (neutral vowel position)
        for i in 0..tract.n {
            let diameter = if i < 7 * tract.n / 44 {
                0.6  // Narrow at glottis
            } else if i < 12 * tract.n / 44 {
                1.1  // Pharynx
            } else {
                1.5  // Oral cavity
            };
            
            tract.diameter[i] = diameter;
            tract.rest_diameter[i] = diameter;
            tract.target_diameter[i] = diameter;
        }
        
        // Set up fixed nose shape
        for i in 0..tract.nose_length {
            let d = 2.0 * i as f32 / tract.nose_length as f32;
            let diameter = if d < 1.0 {
                0.4 + 1.6 * d  // Gradually widen
            } else {
                0.5 + 1.5 * (2.0 - d)  // Then narrow towards nostrils
            };
            
            // Clamp maximum nose diameter
            tract.nose_diameter[i] = f32::min(diameter, 1.9);
        }
        
        // Initial velum setting
        tract.nose_diameter[0] = tract.velum_target;
        
        // Calculate initial reflections
        tract.calculate_reflections();
        tract.calculate_nose_reflections();
        
        tract
    }
    
    pub fn get_n(&self) -> usize {
        self.n
    }
    
    pub fn get_diameter(&self, index: usize) -> f32 {
        if index < self.n {
            self.diameter[index]
        } else {
            0.0
        }
    }
    
    // Run a single timestep of the vocal tract model
    pub fn run_step(&mut self, glottal_output: f32, turbulence_noise: f32, lambda: f32) -> f32 {
        // Clamp input values to prevent instabilities
        let glottal_output = glottal_output.clamp(-1.0, 1.0);
        let turbulence_noise = turbulence_noise.clamp(-1.0, 1.0);
        let lambda = lambda.clamp(0.0, 1.0);
        
        // Process transients (stop consonant bursts)
        self.process_transients();
        
        // Apply glottal reflection and input
        self.junction_output_r[0] = self.l[0] * self.glottal_reflection + glottal_output;
        self.junction_output_l[self.n] = self.r[self.n-1] * self.lip_reflection;
        
        // Calculate wave propagation for the main tract
        for i in 1..self.n {
            let r = self.reflection[i] * (1.0 - lambda) + self.new_reflection[i] * lambda;
            let w = r * (self.r[i-1] + self.l[i]);
            self.junction_output_r[i] = self.r[i-1] - w;
            self.junction_output_l[i] = self.l[i] + w;
        }
        
        // Special calculation for the nose junction
        if self.nose_start < self.n {
            let i = self.nose_start;
            
            // Calculate interpolated reflection coefficients
            let r_left = self.new_reflection_left * (1.0 - lambda) + self.reflection_left * lambda;
            let r_right = self.new_reflection_right * (1.0 - lambda) + self.reflection_right * lambda;
            let r_nose = self.new_reflection_nose * (1.0 - lambda) + self.reflection_nose * lambda;
            
            // Clamp coefficients to a more conservative stable range
            let r_left = r_left.clamp(-0.95, 0.95);
            let r_right = r_right.clamp(-0.95, 0.95);
            let r_nose = r_nose.clamp(-0.95, 0.95);
            
            // Calculate junction outputs
            self.junction_output_l[i] = r_left * self.r[i-1] + (1.0 + r_left) * (self.nose_l[0] + self.l[i]);
            self.junction_output_r[i] = r_right * self.l[i] + (1.0 + r_right) * (self.r[i-1] + self.nose_l[0]);
            self.nose_junction_output_r[0] = r_nose * self.nose_l[0] + (1.0 + r_nose) * (self.l[i] + self.r[i-1]);
        }
        
        // Update the main tract with increased dampening (0.99 instead of 0.999)
        for i in 0..self.n {
            self.r[i] = (self.junction_output_r[i] * 0.99).clamp(-1.0, 1.0);
            self.l[i] = (self.junction_output_l[i+1] * 0.99).clamp(-1.0, 1.0);
        }
        
        // Save the lip output
        self.lip_output = self.r[self.n-1];
        
        // Apply the lip reflection to the nose
        if self.nose_length > 0 {
            self.nose_junction_output_l[self.nose_length] = self.nose_r[self.nose_length-1] * self.lip_reflection;
            
            // Calculate wave propagation for the nose
            for i in 1..self.nose_length {
                let w = self.nose_reflection[i] * (self.nose_r[i-1] + self.nose_l[i]);
                self.nose_junction_output_r[i] = self.nose_r[i-1] - w;
                self.nose_junction_output_l[i] = self.nose_l[i] + w;
            }
            
            // Update the nose
            for i in 0..self.nose_length {
                self.nose_r[i] = (self.nose_junction_output_r[i] * 0.999).clamp(-1.0, 1.0);
                self.nose_l[i] = (self.nose_junction_output_l[i+1] * 0.999).clamp(-1.0, 1.0);
            }
            
            // Save the nose output
            self.nose_output = self.nose_r[self.nose_length-1];
        } else {
            self.nose_output = 0.0;
        }
        
        // Return combined output
        self.lip_output + self.nose_output
    }
    
    // Calculate reflection coefficients based on the tract's current shape
    fn calculate_reflections(&mut self) {
        // Calculate cross-sectional areas from diameters
        for i in 0..self.n {
            // Ensure diameter is non-negative to avoid imaginary areas
            let d = f32::max(self.diameter[i], 0.0001);
            self.a[i] = d * d;  // Area = pi * r^2, ignoring pi
        }
        
        // Calculate reflections at each junction
        for i in 1..self.n {
            self.reflection[i] = self.new_reflection[i];
            
            // Always check for division by zero
            let denominator = self.a[i-1] + self.a[i];
            if denominator < 0.0001 {
                self.new_reflection[i] = 0.999;  // Limit for reflection coefficient
            } else {
                self.new_reflection[i] = (self.a[i-1] - self.a[i]) / denominator;
                
                // Clamp reflection coefficient to valid range [-1, 1]
                // Use more conservative clamping of reflection coefficients
                self.new_reflection[i] = self.new_reflection[i].clamp(-0.95, 0.95);
            }
        }
        
        // Calculate reflections at the nose junction
        self.reflection_left = self.new_reflection_left;
        self.reflection_right = self.new_reflection_right;
        self.reflection_nose = self.new_reflection_nose;
        
        if self.nose_start + 1 < self.n {
            let sum = self.a[self.nose_start] + self.a[self.nose_start+1] + self.nose_a[0];
            
            // Check for division by zero
            if sum < 0.0001 {
                self.new_reflection_left = 0.0;
                self.new_reflection_right = 0.0;
                self.new_reflection_nose = 0.0;
            } else {
                self.new_reflection_left = (2.0 * self.a[self.nose_start] - sum) / sum;
                self.new_reflection_right = (2.0 * self.a[self.nose_start+1] - sum) / sum;
                self.new_reflection_nose = (2.0 * self.nose_a[0] - sum) / sum;
                
                // Clamp reflection coefficients
                // Use more conservative clamping for nose junction reflections
                self.new_reflection_left = self.new_reflection_left.clamp(-0.95, 0.95);
                self.new_reflection_right = self.new_reflection_right.clamp(-0.95, 0.95);
                self.new_reflection_nose = self.new_reflection_nose.clamp(-0.95, 0.95);
            }
        }
    }
    
    // Calculate reflection coefficients for the nasal cavity
    fn calculate_nose_reflections(&mut self) {
        // Calculate cross-sectional areas from diameters
        for i in 0..self.nose_length {
            // Ensure diameter is non-negative
            let d = f32::max(self.nose_diameter[i], 0.0001);
            self.nose_a[i] = d * d;
        }
        
        // Calculate reflections at each junction
        for i in 1..self.nose_length {
            let denominator = self.nose_a[i-1] + self.nose_a[i];
            if denominator < 0.0001 {
                self.nose_reflection[i] = 0.999;  // Prevent division by zero
            } else {
                self.nose_reflection[i] = (self.nose_a[i-1] - self.nose_a[i]) / denominator;
                
                // Clamp reflection coefficient to valid range
                // Use more conservative clamping for nose reflections
                self.nose_reflection[i] = self.nose_reflection[i].clamp(-0.95, 0.95);
            }
        }
    }
    
    // Reshape the vocal tract based on the target shape
    fn reshape(&mut self, delta_time: f32) {
        let amount = delta_time * self.movement_speed;
        let mut new_last_obstruction = None;
        
        // Update the main tract diameters
        for i in 0..self.n {
            let diameter = self.diameter[i];
            let target_diameter = self.target_diameter[i];
            
            // Check for obstructions (for transient creation)
            if diameter <= 0.0 {
                new_last_obstruction = Some(i);
            }
            
            // Different return speeds for different parts of the tract
            let slow_return = if i < self.nose_start {
                0.6  // Pharynx returns slowly
            } else if i >= self.tip_start {
                1.0  // Tip returns quickly
            } else {
                // Gradient between pharynx and tip
                0.6 + 0.4 * (i - self.nose_start) as f32 / 
                    (self.tip_start - self.nose_start) as f32
            };
            
            self.diameter[i] = self.move_towards(diameter, target_diameter, slow_return * amount, 2.0 * amount);
        }
        
        // Check if obstruction was just released
        if self.last_obstruction.is_some() && new_last_obstruction.is_none() && self.nose_a[0] < 0.05 {
            self.add_transient(self.last_obstruction.unwrap());
        }
        self.last_obstruction = new_last_obstruction;
        
        // Update the velum diameter
        self.nose_diameter[0] = self.move_towards(
            self.nose_diameter[0], 
            self.velum_target,
            amount * 0.25, 
            amount * 0.1
        );
        self.nose_a[0] = self.nose_diameter[0] * self.nose_diameter[0];
    }
    
    // Process active transients
    fn process_transients(&mut self) {
        // Apply all active transients
        let time_step = 1.0 / (self.sample_rate * 2.0);
        let mut active_count = 0;
        
        for i in 0..self.n_transients {
            if !self.transients[i].is_active {
                continue;
            }
            
            // Reduce transient strength to minimize plosive noise
            let amplitude = (self.transients[i].strength * 0.5) * 
                f32::powf(2.0, -self.transients[i].exponent * self.transients[i].time_alive);
                
            let position = self.transients[i].position;
            if position < self.r.len() {
                self.r[position] += amplitude / 2.0;
            }
            if position < self.l.len() {
                self.l[position] += amplitude / 2.0;
            }
            
            self.transients[i].time_alive += time_step;
            
            // Remove if expired
            if self.transients[i].time_alive > self.transients[i].life_time {
                self.transients[i].is_active = false;
            } else {
                // If still active, compact array if needed
                if i != active_count {
                    self.transients.swap(i, active_count);
                }
                active_count += 1;
            }
        }
        
        // Update active count
        self.n_transients = active_count;
    }
    
    // Add a transient (plosive burst) at a specific position
    fn add_transient(&mut self, position: usize) {
        if self.n_transients < MAX_TRANSIENTS {
            let index = self.n_transients;
            self.n_transients += 1;
            
            // Create transient with modified parameters for reduced noise
            let mut transient = Transient::new(position);
            transient.strength = 0.2;  // Reduce from 0.3 to 0.2
            transient.exponent = 250.0; // Increase decay rate from 200 to 250
            self.transients[index] = transient;
        }
    }
    
    // Add turbulence noise at a specific position (fricatives)
    pub fn add_turbulence_noise_at_index(&mut self, turbulence_noise: f32, index: f32, diameter: f32, noise_modulator: f32) {
        let i = index.floor() as usize;
        let delta = index - index.floor();
        
        // Modulate noise by the noise modulator signal (from Glottis)
        // Reduce noise gain to 80% of original to minimize distortion
        let turbulence_noise = turbulence_noise * noise_modulator * 0.8;
        
        // Calculate the "thinness" and "openness" based on diameter
        let thinness = (8.0 * (0.7 - diameter)).clamp(0.0, 1.0);
        let openness = (30.0 * (diameter - 0.3)).clamp(0.0, 1.0);
        
        // Apply noise at interpolated position
        let noise0 = turbulence_noise * (1.0 - delta) * thinness * openness;
        let noise1 = turbulence_noise * delta * thinness * openness;
        
        // Add noise to both traveling wave components
        if i+1 < self.n {
            self.r[i+1] += noise0 / 2.0;
            self.l[i+1] += noise0 / 2.0;
        }
        
        if i+2 < self.n {
            self.r[i+2] += noise1 / 2.0;
            self.l[i+2] += noise1 / 2.0;
        }
    }
    
    // Update parameters at the end of an audio block
    pub fn finish_block(&mut self, block_time: f32) {
        self.reshape(block_time);
        self.calculate_reflections();
    }
    
    // Set the target diameter at a specific position
    pub fn set_diameter(&mut self, index: usize, diameter: f32) {
        if index < self.n {
            self.target_diameter[index] = diameter;
        }
    }
    
    // Set the rest diameter at a specific position
    pub fn set_rest_diameter(&mut self, index: usize, diameter: f32) {
        if index < self.n {
            self.rest_diameter[index] = diameter;
        }
    }
    
    // Set the velum target opening
    pub fn set_velum(&mut self, velum_target: f32) {
        self.velum_target = velum_target;
    }
    
    // Reset the tract shape to its rest position
    pub fn reset_to_rest(&mut self) {
        for i in 0..self.n {
            self.target_diameter[i] = self.rest_diameter[i];
        }
    }
    
    // Helper function for smooth movement
    fn move_towards(&self, current: f32, target: f32, slow_return: f32, max_delta: f32) -> f32 {
        let delta = target - current;
        if delta.abs() < max_delta {
            target
        } else if delta > 0.0 {
            current + max_delta
        } else {
            current - slow_return * max_delta
        }
    }
}