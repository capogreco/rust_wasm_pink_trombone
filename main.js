// Main script for the Rust WebAssembly vocal tract AudioWorklet implementation

class VocalTract {
    constructor() {
        this.audioContext = null;
        this.tractNode = null;
        this.wasmModule = null;
        this.isReady = false;
        this.tractSize = 44; // Default, will be updated when WASM initializes
        this.selectedVowel = 'a';
        
        // Tract visualization
        this.tractCanvas = document.getElementById('tractCanvas');
        this.tractCtx = this.tractCanvas.getContext('2d');
        this.tractDiameters = new Array(this.tractSize).fill(1.5); // Default neutral shape
        this.mouseDown = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        // Performance stats
        this.perfStats = {
            avgProcessingTimeMs: 0,
            cpuLoad: 0,
            blockCount: 0
        };
        
        // Vowel shapes
        this.vowels = {
            'a': [0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2],
            'e': [0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.0, 0.8, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.8, 1.0, 1.2, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
            'i': [0.6, 0.6, 0.6, 0.6, 0.6, 0.7, 0.7, 0.7, 0.7, 0.7, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.7, 0.4, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.6, 0.9, 1.2, 1.5, 1.7, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8],
            'o': [0.6, 0.6, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 1.0, 1.1, 1.2, 1.3, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.0, 0.7, 0.4, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.6, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
            'u': [0.6, 0.6, 0.6, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.7, 0.4, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.6, 0.8, 1.0, 1.0, 1.0]
        };
        
        // Setup tract canvas and mouse interactions
        this.setupTractCanvas();
        
        // Bind UI event handlers
        document.getElementById('startButton')?.addEventListener('click', () => this.start());
        document.getElementById('stopButton')?.addEventListener('click', () => this.stop());
        document.querySelectorAll('.vowel-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.selectedVowel = e.target.dataset.vowel;
                this.updateTractShape();
            });
        });
        
        document.getElementById('toggleOscillator')?.addEventListener('click', () => {
            this.toggleOscillator();
        });
        
        // Setup sliders
        this.setupFrequencySlider();
        this.setupTensenessSlider();
        this.setupVoicingToggle();
        this.setupVelumSlider();
        
        console.log('Vocal Tract instance created');
    }
    
    async start() {
        try {
            // Create AudioContext if it doesn't exist
            if (!this.audioContext) {
                this.audioContext = new AudioContext();
                
                // Display sample rate
                document.getElementById('sampleRate').textContent = this.audioContext.sampleRate;
                
                // Add AudioWorklet module
                await this.audioContext.audioWorklet.addModule('worklet-processor.js');
                
                // Fetch WASM files - try both direct and wasm-bindgen approaches
                let wasmBinary;
                let jsGlue = null;
                let useWasmBindgen = false;
                
                try {
                    console.log("Loading WebAssembly files...");
                    
                    // Try loading wasm-bindgen JS module if it exists
                    try {
                        // Check which Rust-generated WASM files exist
                        const checkBindgenWasm = await fetch('vocal_tract_bg.wasm', { method: 'HEAD' })
                            .then(r => r.ok)
                            .catch(() => false);
                            
                        const checkDirectWasm = await fetch('vocal_tract_direct.wasm', { method: 'HEAD' })
                            .then(r => r.ok)
                            .catch(() => false);
                            
                        console.log("Available Rust WASM files:", { 
                            bindgenWasm: checkBindgenWasm, 
                            directWasm: checkDirectWasm
                        });
                        
                        // Try loading direct WASM first - it's more reliable for AudioWorklet
                        if (checkDirectWasm) {
                            const wasmResponse = await fetch('vocal_tract_direct.wasm');
                            wasmBinary = await wasmResponse.arrayBuffer();
                            console.log("Direct Rust WASM binary loaded, size:", wasmBinary.byteLength);
                            // Skip wasm-bindgen setup
                            useWasmBindgen = false;
                            jsGlue = null;
                        } 
                        // No C fallbacks - only using Rust
                        // Try wasm-bindgen as a last resort
                        else if (checkBindgenWasm && !wasmBinary) {
                            try {
                                const jsModule = await import('./vocal_tract.js');
                                jsGlue = jsModule;
                                window.wasmBindgenModule = jsModule;
                                useWasmBindgen = true;
                                console.log("Wasm-bindgen JS module loaded");
                                
                                // Load the corresponding wasm-bindgen WASM file
                                const wasmResponse = await fetch('vocal_tract_bg.wasm');
                                wasmBinary = await wasmResponse.arrayBuffer();
                                console.log("Wasm-bindgen WASM binary loaded, size:", wasmBinary.byteLength);
                            } catch (e) {
                                console.warn("Error loading wasm-bindgen files", e);
                                useWasmBindgen = false;
                            }
                        }
                        // Last resort - try the original file
                        if (!wasmBinary) {
                            try {
                                const wasmResponse = await fetch('vocal_tract.wasm');
                                wasmBinary = await wasmResponse.arrayBuffer();
                                console.log("Original WASM binary loaded as last resort, size:", wasmBinary.byteLength);
                            } catch (e) {
                                console.error("Failed to load any WASM file", e);
                                throw new Error("No compatible WASM file found");
                            }
                        }
                    } catch (e) {
                        console.error("Failed to load any WASM file", e);
                        document.getElementById('statusMessage').textContent = `Error loading WASM: ${e.message}`;
                        throw e;
                    }
                } catch (error) {
                    console.error("Error loading WASM:", error);
                    document.getElementById('statusMessage').textContent = `Error loading WASM: ${error.message}`;
                    throw error;
                }
                
                // Create AudioWorkletNode
                this.tractNode = new AudioWorkletNode(this.audioContext, 'tract-processor', {
                    outputChannelCount: [2],
                    numberOfInputs: 0,
                    numberOfOutputs: 1
                });
                
                // Connect to destination
                this.tractNode.connect(this.audioContext.destination);
                
                // Setup messaging between main thread and AudioWorklet
                this.tractNode.port.onmessage = (event) => this.handleWorkletMessage(event);
                
                // Send the WASM module to the AudioWorklet
                this.tractNode.port.postMessage({
                    type: 'wasm-module',
                    wasmBinary,
                    wasmBindgen: useWasmBindgen,
                    jsGlue: jsGlue ? JSON.stringify(jsGlue) : null
                });
                
                // Setup UI parameter control
                this.setupParameterControls();
                
                // Update UI
                document.getElementById('statusMessage').textContent = 'Initializing WASM module...';
                
                console.log('AudioWorklet and processor node created');
            } else if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
                console.log('AudioContext resumed');
            }
            
            // Update UI
            document.getElementById('startButton').disabled = true;
            document.getElementById('stopButton').disabled = false;
            
        } catch (error) {
            console.error('Error starting audio:', error);
            document.getElementById('statusMessage').textContent = `Error: ${error.message}`;
        }
    }
    
    stop() {
        if (this.audioContext) {
            this.audioContext.suspend();
            
            // Update UI
            document.getElementById('startButton').disabled = false;
            document.getElementById('stopButton').disabled = true;
            document.getElementById('statusMessage').textContent = 'Audio stopped';
            
            console.log('Audio suspended');
        }
    }
    
    // Toggle between direct oscillator and vocal tract model
    toggleOscillator() {
        if (this.tractNode) {
            this.tractNode.port.postMessage({
                type: 'toggle-oscillator'
            });
        }
    }
    
    // Handle messages from the AudioWorklet
    handleWorkletMessage(event) {
        if (event.data.type === 'wasm-init-status') {
            if (event.data.success) {
                console.log('WASM module initialized successfully');
                this.isReady = true;
                
                // Update tract size if provided
                if (event.data.tractSize) {
                    this.tractSize = event.data.tractSize;
                    console.log(`Tract size updated to ${this.tractSize}`);
                    
                    // Resize tractDiameters array if needed
                    if (this.tractDiameters.length !== this.tractSize) {
                        this.tractDiameters = new Array(this.tractSize).fill(1.5);
                    }
                }
                
                // Update UI
                document.getElementById('statusMessage').textContent = 'Ready';
                document.getElementById('tractControls').style.display = 'block';
                
                // Set initial tract shape and redraw UI
                this.updateTractShape();
                this.drawTractUI();
            } else {
                console.error('WASM module initialization failed:', event.data.error);
                document.getElementById('statusMessage').textContent = `WASM initialization failed: ${event.data.error}`;
            }
        } else if (event.data.type === 'performance-report') {
            // Update performance stats
            this.perfStats = event.data.stats;
            
            // Update performance display
            document.getElementById('cpuLoad').textContent = this.perfStats.cpuLoad.toFixed(1) + '%';
            document.getElementById('processingTime').textContent = this.perfStats.avgProcessingTimeMs.toFixed(2) + 'ms';
            
            // Debug info
            if (this.perfStats.glottalLevel !== undefined) {
                document.getElementById('glottalLevel').textContent = this.perfStats.glottalLevel.toFixed(3);
            }
            if (this.perfStats.tractLevel !== undefined) {
                document.getElementById('tractLevel').textContent = this.perfStats.tractLevel.toFixed(3);
            }
        } else if (event.data.type === 'oscillator-status') {
            // Update oscillator status
            document.getElementById('oscillatorStatus').textContent = 
                event.data.enabled ? 'Direct Oscillator' : 'Vocal Tract Model';
        }
    }
    
    // Set up frequency slider
    setupFrequencySlider() {
        const frequencySlider = document.getElementById('frequencySlider');
        const frequencyValue = document.getElementById('frequencyValue');
        
        if (frequencySlider && frequencyValue) {
            frequencySlider.addEventListener('input', () => {
                const value = frequencySlider.value;
                frequencyValue.textContent = value;
                
                if (this.tractNode) {
                    this.tractNode.parameters.get('frequency').value = parseFloat(value);
                }
            });
        }
    }
    
    // Set up tenseness slider
    setupTensenessSlider() {
        const tensenessSlider = document.getElementById('tensenessSlider');
        const tensenessValue = document.getElementById('tensenessValue');
        
        if (tensenessSlider && tensenessValue) {
            tensenessSlider.addEventListener('input', () => {
                const value = tensenessSlider.value;
                tensenessValue.textContent = value;
                
                if (this.tractNode) {
                    this.tractNode.parameters.get('tenseness').value = parseFloat(value);
                }
            });
        }
    }
    
    // Set up voicing toggle
    setupVoicingToggle() {
        const voicingToggle = document.getElementById('voicingToggle');
        
        if (voicingToggle) {
            voicingToggle.addEventListener('change', () => {
                if (this.tractNode) {
                    this.tractNode.parameters.get('voicing').value = voicingToggle.checked ? 1 : 0;
                }
            });
        }
    }
    
    // Set up velum slider
    setupVelumSlider() {
        const velumSlider = document.getElementById('velumSlider');
        const velumValue = document.getElementById('velumValue');
        
        if (velumSlider && velumValue) {
            velumSlider.addEventListener('input', () => {
                const value = velumSlider.value;
                velumValue.textContent = value;
                
                if (this.tractNode) {
                    this.tractNode.parameters.get('velum').value = parseFloat(value);
                }
            });
        }
    }
    
    // Setup all parameter controls
    setupParameterControls() {
        if (this.tractNode) {
            // Set initial parameter values from UI
            const frequencySlider = document.getElementById('frequencySlider');
            const tensenessSlider = document.getElementById('tensenessSlider');
            const voicingToggle = document.getElementById('voicingToggle');
            const velumSlider = document.getElementById('velumSlider');
            
            if (frequencySlider) {
                this.tractNode.parameters.get('frequency').value = parseFloat(frequencySlider.value);
            }
            
            if (tensenessSlider) {
                this.tractNode.parameters.get('tenseness').value = parseFloat(tensenessSlider.value);
            }
            
            if (voicingToggle) {
                this.tractNode.parameters.get('voicing').value = voicingToggle.checked ? 1 : 0;
            }
            
            if (velumSlider) {
                this.tractNode.parameters.get('velum').value = parseFloat(velumSlider.value);
            }
        }
    }
    
    // Update vocal tract shape based on selected vowel
    // Setup the tract visualization canvas
    setupTractCanvas() {
        if (!this.tractCanvas) return;
        
        // Set initial dimensions
        this.tractCanvas.width = 600;
        this.tractCanvas.height = 200;
        
        // Initialize with neutral tract shape
        this.tractDiameters = new Array(this.tractSize).fill(1.5);
        
        // Draw initial state
        this.drawTractUI();
        
        // Mouse event handlers for interaction
        this.tractCanvas.addEventListener('mousedown', (e) => {
            this.mouseDown = true;
            const rect = this.tractCanvas.getBoundingClientRect();
            this.lastMouseX = e.clientX - rect.left;
            this.lastMouseY = e.clientY - rect.top;
            this.updateTractAtPosition(this.lastMouseX, this.lastMouseY);
        });
        
        this.tractCanvas.addEventListener('mousemove', (e) => {
            if (this.mouseDown) {
                const rect = this.tractCanvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                this.updateTractAtPosition(mouseX, mouseY);
                this.lastMouseX = mouseX;
                this.lastMouseY = mouseY;
            }
        });
        
        this.tractCanvas.addEventListener('mouseup', () => {
            this.mouseDown = false;
        });
        
        this.tractCanvas.addEventListener('mouseleave', () => {
            this.mouseDown = false;
        });
    }
    
    // Draw the tract visualization
    drawTractUI() {
        if (!this.tractCanvas || !this.tractCtx) return;
        
        // Clear canvas
        this.tractCtx.fillStyle = '#1a1a1a'; // Dark background
        this.tractCtx.fillRect(0, 0, this.tractCanvas.width, this.tractCanvas.height);
        
        // Draw tract shape
        const width = this.tractCanvas.width;
        const height = this.tractCanvas.height;
        const segmentWidth = width / this.tractSize;
        
        // Draw the centerline
        this.tractCtx.beginPath();
        this.tractCtx.moveTo(0, height / 2);
        this.tractCtx.lineTo(width, height / 2);
        this.tractCtx.strokeStyle = '#444444';
        this.tractCtx.stroke();
        
        // Draw the tract shape
        this.tractCtx.beginPath();
        for (let i = 0; i < this.tractSize; i++) {
            const diameter = this.tractDiameters[i] || 0;
            const x = i * segmentWidth;
            const halfSize = (diameter / 3.0) * (height / 2); // Scale diameter 
            
            if (i === 0) {
                this.tractCtx.moveTo(x, height / 2 - halfSize);
            } else {
                this.tractCtx.lineTo(x, height / 2 - halfSize);
            }
        }
        
        // Draw the bottom half (mirror of the top)
        for (let i = this.tractSize - 1; i >= 0; i--) {
            const diameter = this.tractDiameters[i] || 0;
            const x = i * segmentWidth;
            const halfSize = (diameter / 3.0) * (height / 2);
            this.tractCtx.lineTo(x, height / 2 + halfSize);
        }
        
        this.tractCtx.closePath();
        this.tractCtx.fillStyle = 'rgba(66, 133, 244, 0.5)'; // Blue with transparency
        this.tractCtx.fill();
        this.tractCtx.strokeStyle = '#4285f4'; // Solid blue outline
        this.tractCtx.stroke();
        
        // Label parts of the tract
        this.tractCtx.fillStyle = '#e0e0e0'; // Light text on dark background
        this.tractCtx.font = '12px Arial';
        this.tractCtx.fillText('Glottis', 5, 20);
        this.tractCtx.fillText('Pharynx', width * 0.2, 20);
        this.tractCtx.fillText('Palate', width * 0.5, 20);
        this.tractCtx.fillText('Lips', width * 0.9, 20);
    }
    
    // Update tract shape at mouse position
    updateTractAtPosition(mouseX, mouseY) {
        // Convert X position to tract index
        const index = Math.floor((mouseX / this.tractCanvas.width) * this.tractSize);
        
        // Convert Y position to diameter (invert Y since canvas draws from top to bottom)
        const normalizedY = (this.tractCanvas.height - mouseY) / this.tractCanvas.height;
        const diameter = normalizedY * 3.0; // Scale to reasonable diameter range (0-3)
        
        // Update tract shape if index is valid
        if (index >= 0 && index < this.tractSize) {
            this.tractDiameters[index] = diameter;
            this.sendTractShape(this.tractDiameters);
            this.drawTractUI();
        }
    }
    
    // Send tract shape to the AudioWorklet
    sendTractShape(shape) {
        if (!this.tractNode) return;
        
        this.tractNode.port.postMessage({
            type: 'tract-diameters',
            diameters: shape
        });
    }
    
    // Update tract shape from vowel selection
    updateTractShape() {
        if (!this.isReady || !this.tractNode) return;
        
        // Get the vowel shape
        const vowelShape = this.vowels[this.selectedVowel];
        if (!vowelShape) return;
        
        // Resize to match current tract size if needed
        let diameters;
        if (vowelShape.length !== this.tractSize) {
            diameters = new Array(this.tractSize);
            for (let i = 0; i < this.tractSize; i++) {
                const normalizedPos = i / (this.tractSize - 1);
                const sourceIndex = Math.floor(normalizedPos * (vowelShape.length - 1));
                diameters[i] = vowelShape[sourceIndex];
            }
        } else {
            diameters = vowelShape;
        }
        
        // Update internal state
        this.tractDiameters = diameters.slice();
        
        // Send to AudioWorklet
        this.tractNode.port.postMessage({
            type: 'tract-diameters',
            diameters
        });
        
        // Update visualization
        this.drawTractUI();
        
        // Update UI to show selected vowel
        document.querySelectorAll('.vowel-button').forEach(button => {
            if (button.dataset.vowel === this.selectedVowel) {
                button.classList.add('selected');
            } else {
                button.classList.remove('selected');
            }
        });
    }
}

// Create and initialize the vocal tract when the page loads
window.addEventListener('DOMContentLoaded', () => {
    window.vocalTract = new VocalTract();
});