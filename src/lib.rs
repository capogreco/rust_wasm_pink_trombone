use wasm_bindgen::prelude::*;
mod tract;
mod glottis;

// Set up panic hook for better error messages
#[cfg(feature = "console_error_panic_hook")]
fn set_panic_hook() {
    console_error_panic_hook::set_once();
}

#[cfg(not(feature = "console_error_panic_hook"))]
fn set_panic_hook() {}

// Static instances for simplified API
static mut TRACT: Option<tract::Tract> = None;
static mut GLOTTIS: Option<glottis::Glottis> = None;

// ======= GLOTTIS API =======

#[wasm_bindgen]
pub fn init_glottis(sample_rate: f32) {
    set_panic_hook();
    unsafe {
        GLOTTIS = Some(glottis::Glottis::new(sample_rate));
    }
}

#[wasm_bindgen]
pub fn set_frequency(frequency: f32) {
    unsafe {
        if let Some(glottis) = &mut GLOTTIS {
            glottis.set_frequency(frequency);
        }
    }
}

#[wasm_bindgen]
pub fn set_tenseness(tenseness: f32) {
    unsafe {
        if let Some(glottis) = &mut GLOTTIS {
            glottis.set_tenseness(tenseness);
        }
    }
}

#[wasm_bindgen]
pub fn set_voiced(voiced: bool) {
    unsafe {
        if let Some(glottis) = &mut GLOTTIS {
            glottis.set_voiced(voiced);
        }
    }
}

#[wasm_bindgen]
pub fn process_glottis(noise_source: f32) -> f32 {
    unsafe {
        if let Some(glottis) = &mut GLOTTIS {
            glottis.process(noise_source)
        } else {
            0.0
        }
    }
}

#[wasm_bindgen]
pub fn get_noise_modulator() -> f32 {
    unsafe {
        if let Some(glottis) = &GLOTTIS {
            glottis.get_noise_modulator()
        } else {
            0.0
        }
    }
}

#[wasm_bindgen]
pub fn glottis_finish_block() {
    unsafe {
        if let Some(glottis) = &mut GLOTTIS {
            glottis.finish_block();
        }
    }
}

// ======= TRACT API =======

#[wasm_bindgen]
pub fn init_tract(sample_rate: f32) {
    set_panic_hook();
    unsafe {
        TRACT = Some(tract::Tract::new(sample_rate));
    }
}

#[wasm_bindgen]
pub fn free_tract() {
    unsafe {
        TRACT = None;
    }
}

#[wasm_bindgen]
pub fn process_tract(glottal_output: f32, turbulence_noise: f32, lambda: f32) -> f32 {
    unsafe {
        if let Some(tract) = &mut TRACT {
            tract.run_step(glottal_output, turbulence_noise, lambda)
        } else {
            0.0
        }
    }
}

#[wasm_bindgen]
pub fn tract_finish_block(block_time: f32) {
    unsafe {
        if let Some(tract) = &mut TRACT {
            tract.finish_block(block_time);
        }
    }
}

#[wasm_bindgen]
pub fn set_diameter(index: usize, diameter: f32) {
    unsafe {
        if let Some(tract) = &mut TRACT {
            tract.set_diameter(index, diameter);
        }
    }
}

#[wasm_bindgen]
pub fn set_rest_diameter(index: usize, diameter: f32) {
    unsafe {
        if let Some(tract) = &mut TRACT {
            tract.set_rest_diameter(index, diameter);
        }
    }
}

#[wasm_bindgen]
pub fn set_velum(velum_target: f32) {
    unsafe {
        if let Some(tract) = &mut TRACT {
            tract.set_velum(velum_target);
        }
    }
}

#[wasm_bindgen]
pub fn reset_to_rest() {
    unsafe {
        if let Some(tract) = &mut TRACT {
            tract.reset_to_rest();
        }
    }
}

#[wasm_bindgen]
pub fn add_turbulence_noise(turbulence_noise: f32, index: f32, diameter: f32, noise_modulator: f32) {
    unsafe {
        if let Some(tract) = &mut TRACT {
            tract.add_turbulence_noise_at_index(turbulence_noise, index, diameter, noise_modulator);
        }
    }
}

#[wasm_bindgen]
pub fn get_tract_size() -> usize {
    unsafe {
        if let Some(tract) = &TRACT {
            tract.get_n()
        } else {
            0
        }
    }
}

#[wasm_bindgen]
pub fn get_diameter(index: usize) -> f32 {
    unsafe {
        if let Some(tract) = &TRACT {
            tract.get_diameter(index)
        } else {
            0.0
        }
    }
}

#[wasm_bindgen]
pub fn get_lip_output() -> f32 {
    unsafe {
        if let Some(tract) = &TRACT {
            tract.lip_output
        } else {
            0.0
        }
    }
}

#[wasm_bindgen]
pub fn get_nose_output() -> f32 {
    unsafe {
        if let Some(tract) = &TRACT {
            tract.nose_output
        } else {
            0.0
        }
    }
}