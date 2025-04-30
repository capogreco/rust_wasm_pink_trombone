// AudioWorklet processor for the Rust WebAssembly vocal tract model
// This processor serves as the interface between the audio thread and the WASM module

class TractProcessor extends AudioWorkletProcessor {
    // Define parameters that can be controlled from the main thread
    static get parameterDescriptors() {
        return [
            // Glottis parameters
            {
                name: 'frequency',
                defaultValue: 140,
                minValue: 50,
                maxValue: 500,
                automationRate: 'a-rate'
            },
            {
                name: 'tenseness',
                defaultValue: 0.6,
                minValue: 0.01,
                maxValue: 0.99,
                automationRate: 'a-rate'
            },
            {
                name: 'voicing',
                defaultValue: 1,
                minValue: 0,
                maxValue: 1,
                automationRate: 'k-rate'
            },
            // Tract parameters
            {
                name: 'velum',
                defaultValue: 0.01,
                minValue: 0,
                maxValue: 1,
                automationRate: 'a-rate'
            }
            // Note: Diameters are controlled via messages, not AudioParams
        ];
    }
    
    constructor() {
        super();
        
        // Initialize internal state
        this.wasmInstance = null;
        this.isReady = false;
        this.isInitializing = false;
        
        // For generating white noise
        this.noiseBuffer = new Float32Array(1024);
        this.noiseBufferPosition = 0;
        this.fillNoiseBuffer();
        
        // For direct testing - use a simple oscillator
        this.phase = 0;
        this.useDirectOscillator = false;
        this.oscillatorVolume = 0.5;
        
        // Low-pass filter state
        this.lastOutput = 0;
        
        // Performance monitoring
        this.lastPerfUpdate = 0;
        this.perfStats = {
            avgProcessingTime: 0,
            blockCount: 0,
            totalProcessingTime: 0
        };
        
        // Tract state
        this.tractDiameters = [];
        this.tractTargetDiameters = [];
        this.tractSize = 44; // Default size
        this.constrictions = []; // For fricatives
        
        // Set up message port for receiving the WASM module and control data
        this.port.onmessage = (event) => {
            if (event.data.type === 'wasm-module') {
                // Always use direct instantiation - more reliable
                console.log("Using direct WASM instantiation mode");
                this.initializeWasm(event.data.wasmBinary);
            } else if (event.data.type === 'tract-diameters') {
                this.updateTractDiameters(event.data.diameters);
            } else if (event.data.type === 'add-constriction') {
                this.addConstriction(event.data.index, event.data.diameter, event.data.fricative);
            } else if (event.data.type === 'clear-constrictions') {
                this.constrictions = [];
            } else if (event.data.type === 'toggle-oscillator') {
                this.useDirectOscillator = !this.useDirectOscillator;
                console.log(`Direct oscillator toggled to: ${this.useDirectOscillator ? 'enabled' : 'disabled'}`);
                
                this.port.postMessage({
                    type: 'oscillator-status',
                    enabled: this.useDirectOscillator
                });
            }
        };
        
        // Log to confirm processor is created
        console.log('TractProcessor initialized');
    }
    
    // Fill noise buffer with random values
    fillNoiseBuffer() {
        for (let i = 0; i < this.noiseBuffer.length; i++) {
            this.noiseBuffer[i] = Math.random() * 2 - 1;
        }
    }
    
    // Get a noise sample
    getNoiseSource() {
        // Get current noise sample
        const sample = this.noiseBuffer[this.noiseBufferPosition];
        
        // Update position
        this.noiseBufferPosition = (this.noiseBufferPosition + 1) % this.noiseBuffer.length;
        
        // Refill buffer if at the end
        if (this.noiseBufferPosition === 0) {
            this.fillNoiseBuffer();
        }
        
        return sample;
    }
    
    // Initialize using wasm-bindgen generated JS glue code
    async initializeWasmBindgen(wasmBinary, jsGlue) {
        try {
            this.isInitializing = true;
            
            console.log("Initializing with wasm-bindgen glue code");
            // This would ideally use the JS glue code, but it's tricky in AudioWorklet
            // For now, we'll fall back to direct initialization
            
            this.initializeWasm(wasmBinary);
        } catch (error) {
            this.isReady = false;
            this.isInitializing = false;
            
            console.error('Failed to initialize WASM with wasm-bindgen:', error);
            
            this.port.postMessage({
                type: 'wasm-init-status',
                success: false,
                error: error.toString()
            });
        }
    }
    
    // Analyze WASM imports to understand requirements
    async analyzeWasmImports(wasmBinary) {
        try {
            const module = await WebAssembly.compile(wasmBinary);
            const imports = WebAssembly.Module.imports(module);
            console.log("WASM Module Imports:", imports);
            return imports;
        } catch (e) {
            console.error("Error analyzing WASM imports:", e);
            return [];
        }
    }
    
    // Initialize the WASM module directly
    async initializeWasm(wasmBinary) {
        try {
            // Set flag to indicate we're initializing
            this.isInitializing = true;
            
            // Compile the WASM module
            const module = await WebAssembly.compile(wasmBinary);
            
            // Analyze imports to understand module requirements
            const requiredImports = WebAssembly.Module.imports(module);
            console.log("WASM required imports:", requiredImports);
            
            // Build a dynamic import object based on required imports
            const importObject = {
                // Basic math functions needed for audio processing
                env: {
                    // Math functions
                    sinf: Math.sin,
                    cosf: Math.cos,
                    expf: Math.exp,
                    sqrtf: Math.sqrt,
                    powf: Math.pow,
                    logf: Math.log,
                    fmaxf: Math.max,
                    fminf: Math.min,
                    
                    // Random number generation
                    random_number: () => Math.random(),
                    
                    // Memory management (required by wasm-bindgen)
                    emscripten_notify_memory_growth: () => {}
                },
                
                // Empty placeholders for other potential namespaces
                __wbindgen_placeholder__: {}
            };
            
            // Go through all required imports and ensure they exist
            for (const imp of requiredImports) {
                const { module: modName, name: funcName } = imp;
                
                // Create the module namespace if it doesn't exist
                if (!importObject[modName]) {
                    importObject[modName] = {};
                    console.log(`Created namespace: ${modName}`);
                }
                
                // Skip if the function already exists
                if (importObject[modName][funcName]) {
                    continue;
                }
                
                // Add a dummy function that logs when called
                importObject[modName][funcName] = function(...args) {
                    console.log(`Called import ${modName}.${funcName} with args:`, args);
                    
                    // Special cases
                    if (funcName === '__wbindgen_describe') return args[0];
                    if (funcName.includes('__wbg_new')) return {};
                    if (funcName.includes('wbindgen_memory')) return new WebAssembly.Memory({ initial: 256 });
                    
                    // Default return value
                    return 0;
                };
                
                console.log(`Added dummy function for: ${modName}.${funcName}`);
            }
            
            console.log("Final import object:", importObject);
            
            // Instantiate the Rust WASM module
            console.log("Instantiating Rust WASM module...");
            let instance;
            try {
                instance = await WebAssembly.instantiate(module, importObject);
                console.log("Rust WASM module instantiated successfully");
            } catch (error) {
                console.error("Failed to instantiate Rust WASM module:", error);
                throw new Error("Could not instantiate Rust WASM module: " + error.message);
            }
            
            // Store the instance
            this.wasmInstance = instance;
            
            // For debugging, list the exported functions
            console.log('Available WASM exports:', Object.keys(instance.exports));
            
            // Verify essential functions exist (with C naming convention fallbacks)
            const requiredFunctions = [
                ['init_glottis', '_init_glottis'],
                ['init_tract', '_init_tract'],
                ['process_glottis', '_process_glottis'],
                ['process_tract', '_process_tract']
            ];
            
            for (const [mainName, fallbackName] of requiredFunctions) {
                if (typeof instance.exports[mainName] !== 'function' && 
                    typeof instance.exports[fallbackName] !== 'function') {
                    throw new Error(`Required function ${mainName} or ${fallbackName} not found`);
                }
                
                // If only fallback exists, create an alias to the main name
                if (typeof instance.exports[mainName] !== 'function' && 
                    typeof instance.exports[fallbackName] === 'function') {
                    console.log(`Creating alias from ${fallbackName} to ${mainName}`);
                    instance.exports[mainName] = instance.exports[fallbackName];
                }
            }
            
            // Initialize the glottis and tract with our sample rate
            try {
                console.log("Calling init functions with sample rate:", globalThis.sampleRate);
                instance.exports.init_glottis(globalThis.sampleRate);
                instance.exports.init_tract(globalThis.sampleRate);
                console.log("Initialization successful");
                
                // Get the tract size - default to 44 if function missing
                try {
                    this.tractSize = instance.exports.get_tract_size ? 
                        instance.exports.get_tract_size() : 
                        (instance.exports._get_tract_size ? instance.exports._get_tract_size() : 44);
                } catch (e) {
                    console.warn("Could not get tract size, using default:", e);
                    this.tractSize = 44;
                }
                
                console.log(`Tract initialized with ${this.tractSize} segments`);
                
                // Initialize tract diameters arrays
                this.tractDiameters = new Array(this.tractSize).fill(0);
                this.tractTargetDiameters = new Array(this.tractSize).fill(0);
                
                // Test if the model actually works
                const noiseSource = Math.random() * 2 - 1;
                const glottalOutput = this.wasmInstance.exports.process_glottis(noiseSource);
                const tractOutput = this.wasmInstance.exports.process_tract(glottalOutput, noiseSource, 0.5);
                console.log("Test outputs - Glottal:", glottalOutput, "Tract:", tractOutput);
                
                // Mark as ready
                this.isReady = true;
                this.isInitializing = false;
            } catch (e) {
                console.error("Error initializing modules:", e);
                this.isReady = false;
                this.isInitializing = false;
                throw e;
            }
            
            // Signal success
            console.log('WASM module initialized successfully');
            
            this.port.postMessage({
                type: 'wasm-init-status',
                success: true,
                tractSize: this.tractSize
            });
            
        } catch (error) {
            this.isReady = false;
            this.isInitializing = false;
            
            console.error('Failed to initialize WASM module:', error);
            
            this.port.postMessage({
                type: 'wasm-init-status',
                success: false,
                error: error.toString()
            });
        }
    }
    
    // Update tract diameters from main thread
    updateTractDiameters(diameters) {
        if (!this.isReady) return;
        
        // Set diameters in WASM
        for (let i = 0; i < diameters.length && i < this.tractSize; i++) {
            this.wasmInstance.exports.set_diameter(i, diameters[i]);
            this.tractTargetDiameters[i] = diameters[i];
        }
    }
    
    // Add a constriction (for fricatives)
    addConstriction(index, diameter, fricative) {
        this.constrictions.push({ index, diameter, fricative });
    }
    
    // Report performance metrics every second
    reportPerformance(currentTime) {
        if (currentTime - this.lastPerfUpdate >= 1.0) {
            const stats = {
                avgProcessingTimeMs: this.perfStats.avgProcessingTime * 1000,
                cpuLoad: (this.perfStats.avgProcessingTime / (128/globalThis.sampleRate)) * 100,
                blockCount: this.perfStats.blockCount
            };
            
            // Debug output levels
            if (this.wasmInstance) {
                try {
                    const noiseSource = Math.random() * 2 - 1;
                    const glottalOutput = this.wasmInstance.exports.process_glottis(noiseSource);
                    const tractOutput = this.wasmInstance.exports.process_tract(glottalOutput, noiseSource, 0.5);
                    
                    stats.glottalLevel = Math.abs(glottalOutput);
                    stats.tractLevel = Math.abs(tractOutput);
                } catch (e) {
                    stats.error = e.toString();
                }
            }
            
            this.port.postMessage({
                type: 'performance-report',
                stats: stats
            });
            
            // Reset performance tracking
            this.lastPerfUpdate = currentTime;
            this.perfStats.avgProcessingTime = 0;
            this.perfStats.blockCount = 0;
            this.perfStats.totalProcessingTime = 0;
        }
    }
    
    // Process audio data
    process(inputs, outputs, parameters) {
        // Start timing this block
        const blockStartTime = globalThis.currentTime;
        
        // Get the output
        const output = outputs[0];
        if (output.length === 0) return true;
        
        // Get parameters
        const frequencyParam = parameters.frequency;
        const tensenessParam = parameters.tenseness;
        const voicingParam = parameters.voicing;
        const velumParam = parameters.velum;
        
        // Check if parameters are constant for this block
        const freqConstant = frequencyParam.length === 1;
        const tenseConstant = tensenessParam.length === 1;
        const velumConstant = velumParam.length === 1;
        
        // Extract the current value of voicing (k-rate)
        const voicing = voicingParam[0] > 0.5;
        
        // Check if module is still initializing
        if (this.isInitializing) {
            // Fill output with silence during initialization
            for (let channel = 0; channel < output.length; channel++) {
                const outputChannel = output[channel];
                for (let i = 0; i < outputChannel.length; i++) {
                    outputChannel[i] = 0;
                }
            }
            this.perfStats.blockCount++;
            return true;
        }
        
        // Check if module is ready
        if (!this.isReady) {
            // If WASM failed to initialize, output silence and log error
            for (let channel = 0; channel < output.length; channel++) {
                const outputChannel = output[channel];
                for (let i = 0; i < outputChannel.length; i++) {
                    outputChannel[i] = 0;
                }
            }
            
            // Log error periodically
            if (this.perfStats.blockCount % 100 === 0) {
                console.error('WASM module not initialized - audio output silenced');
            }
            
            this.perfStats.blockCount++;
            return true;
        }
        
        // Module is ready, process audio
        try {
            // Update voice parameters at start of block
            this.wasmInstance.exports.set_voiced(voicing ? 1 : 0);
            
            // Set velum parameter at start of block if constant
            if (velumConstant) {
                this.wasmInstance.exports.set_velum(velumParam[0]);
            }
            
            // Process audio for this block
            const firstChannel = output[0];
            for (let i = 0; i < firstChannel.length; i++) {
                // Update parameters for this sample
                const frequency = freqConstant ? frequencyParam[0] : frequencyParam[i];
                const tenseness = tenseConstant ? tensenessParam[0] : tensenessParam[i];
                
                // Update velum position if not constant
                if (!velumConstant) {
                    this.wasmInstance.exports.set_velum(velumParam[i]);
                }
                
                // Set glottis parameters
                this.wasmInstance.exports.set_frequency(frequency);
                this.wasmInstance.exports.set_tenseness(tenseness);
                
                // Get noise source for both glottis and turbulence
                const noiseSource = this.getNoiseSource();
                
                // Process glottis to generate glottal pulse
                let glottalOutput;
                try {
                    glottalOutput = this.wasmInstance.exports.process_glottis(noiseSource);
                    
                    // Check for NaN outputs
                    if (isNaN(glottalOutput)) {
                        console.error(`NaN detected in glottis output at block ${this.perfStats.blockCount}, sample ${i}`);
                        glottalOutput = 0;
                    }
                } catch (e) {
                    console.error(`Error in glottis processing: ${e}`);
                    glottalOutput = 0;
                }
                
                // Get noise modulator for fricatives
                const noiseModulator = this.wasmInstance.exports.get_noise_modulator();
                
                // Process any active constrictions (fricatives)
                for (const constriction of this.constrictions) {
                    if (constriction.fricative > 0) {
                        this.wasmInstance.exports.add_turbulence_noise(
                            noiseSource * constriction.fricative, 
                            constriction.index, 
                            constriction.diameter, 
                            noiseModulator
                        );
                    }
                }
                
                // Process vocal tract with glottal output
                const lambda = i / firstChannel.length; // Interpolation factor
                
                let tractOutput;
                try {
                    tractOutput = this.wasmInstance.exports.process_tract(glottalOutput, noiseSource, lambda);
                } catch (e) {
                    console.error(`Tract processing error at block ${this.perfStats.blockCount}, sample ${i}: ${e}`);
                    tractOutput = glottalOutput; // On error, use direct glottal output
                }
                
                // Check for NaN and replace if needed
                if (isNaN(tractOutput)) {
                    tractOutput = 0;
                }
                
                // Simple low-pass filter to reduce high-frequency artifacts
                // Keep only 90% of current output and mix in 10% of previous sample
                // This is a very basic first-order low-pass filter
                // We statically define the filter coefficients for simplicity
                const lpfAlpha = 0.1; // Filter strength (0 = no filtering, higher values = more filtering)
                
                if (i === 0) {
                    // Initialize the filter state with the first sample
                    this.lastOutput = tractOutput;
                }
                
                // Apply the low-pass filter
                const filteredOutput = (1 - lpfAlpha) * tractOutput + lpfAlpha * this.lastOutput;
                this.lastOutput = filteredOutput;
                
                // Apply gain to increase audibility
                const gainedOutput = filteredOutput * 5.0;
                
                // Write output to all channels
                for (let channel = 0; channel < output.length; channel++) {
                    // Use either the model output or a direct oscillator for testing
                    if (this.useDirectOscillator) {
                        // Generate a simple sine wave with the frequency parameter
                        this.phase += 2 * Math.PI * frequency / globalThis.sampleRate;
                        if (this.phase > 2 * Math.PI) this.phase -= 2 * Math.PI;
                        
                        // Use a loud sine wave regardless of voicing for testing
                        const oscOutput = this.oscillatorVolume * Math.sin(this.phase);
                        
                        // Use just oscillator output for testing - no mixing
                        output[channel][i] = oscOutput;
                    } else {
                        output[channel][i] = gainedOutput;
                    }
                }
            }
            
            // End of block processing
            this.wasmInstance.exports.glottis_finish_block();
            this.wasmInstance.exports.tract_finish_block(128 / globalThis.sampleRate); // Block time in seconds
            
        } catch (error) {
            console.error('Error in WASM processing:', error);
            // Fill output with silence on error
            for (let channel = 0; channel < output.length; channel++) {
                const outputChannel = output[channel];
                for (let i = 0; i < outputChannel.length; i++) {
                    outputChannel[i] = 0;
                }
            }
        }
        
        // Calculate processing time for this block
        const blockTime = globalThis.currentTime - blockStartTime;
        this.perfStats.totalProcessingTime += blockTime;
        this.perfStats.blockCount++;
        this.perfStats.avgProcessingTime = this.perfStats.totalProcessingTime / this.perfStats.blockCount;
        
        // Report performance periodically
        this.reportPerformance(globalThis.currentTime);
        
        // Return true to keep the processor alive
        return true;
    }
}

// Register the processor
registerProcessor('tract-processor', TractProcessor);