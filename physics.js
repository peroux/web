const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const gravity = 0.05; // Slower falling gravity for shooting stars
const friction = 0.9;
const { charWidth, lineHeight } = measureCharSize();

const asciiBackground = document.querySelector('.ascii-background');

// ============= GROUND CONFIGURATION =============
// Single configuration object for ground settings
const GroundConfig = {
    // Set this value to adjust ground height (pixels from bottom of screen)
    // Increase this number to raise the ground higher on screen
    offsetFromBottom: 0,
    
    // Get current ground level in pixels (calculated from HR element or fallback)
    get level() {
        const hrElement = document.querySelector('hr');
        if (hrElement) {
            const rect = hrElement.getBoundingClientRect();
            return rect.bottom;
        }
        return canvas.height - this.offsetFromBottom;
    },
    
    // Get ground level in grid rows
    get row() {
        return Math.floor(this.level / lineHeight);
    },
    
    // Position an element at ground level given its height in grid rows
    positionAtGround(heightInRows) {
        return this.level - (heightInRows * lineHeight) + lineHeight;
    }
};

// Update ground level after page loads
window.addEventListener('load', () => {
    setTimeout(() => {
        console.log('Ground level set to:', GroundConfig.level);
    }, 100);
});

function measureCharSize() {
    const tempSpan = document.createElement('span');
    tempSpan.style.fontFamily = 'Courier New, Courier, monospace';
    tempSpan.style.fontSize = '16px';
    tempSpan.style.position = 'absolute';
    tempSpan.style.visibility = 'hidden';
    tempSpan.textContent = '|';
    document.body.appendChild(tempSpan);
    const charWidth = tempSpan.offsetWidth / 1.04;
    const lineHeight = tempSpan.offsetHeight / 1.17;
    document.body.removeChild(tempSpan);
    return { charWidth, lineHeight };
}

function generateAsciiBackground() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const character = '|';
    let content = '';

    const rows = Math.ceil(height / lineHeight);
    const cols = Math.ceil(width / charWidth);

    // Update cached dimensions
    updateGridDimensions();

    // OPTIMIZATION: Create a document fragment to reduce reflows
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('div');
    
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            content += `<span style="color: #191919;">${character}</span>`;
        }
        content += '<br>';
    }
    
    tempDiv.innerHTML = content;
    fragment.appendChild(tempDiv);
    asciiBackground.innerHTML = '';
    asciiBackground.appendChild(tempDiv.firstChild ? tempDiv : fragment);
    
    // Store spans reference for faster access
    window.backgroundSpans = asciiBackground.querySelectorAll('span');
}

window.addEventListener('resize', generateAsciiBackground);
window.addEventListener('load', generateAsciiBackground);

class TextParticle {
    constructor(x, y, dx, dy, text, font, color) {
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.text = text;
        this.font = font;
        this.color = color;
        this.exploded = false;
        this.shouldRemove = false;
    }

    draw() {
        ctx.font = this.font;
        ctx.fillStyle = this.color;
        ctx.fillText(this.text, this.x, this.y);
    }

    update() {
        // Check for ground collision
        if (this.y + this.dy >= GroundConfig.level) {
            if (!this.exploded) {
                animateExplosion(this.x, GroundConfig.level, 5); // Explosion at ground level
                this.exploded = true;
                this.shouldRemove = true;
            }
            return;
        }

        // Apply gravity
        this.dy += gravity;

        // Wall collision
        if (this.x + ctx.measureText(this.text).width + this.dx > canvas.width || this.x + this.dx < 0) {
            this.dx = -this.dx * friction;
        }

        this.x += this.dx;
        this.y += this.dy;
        this.draw();
    }
}

function getGradientColor(startColor, endColor, percentage) {
    const start = parseInt(startColor.slice(1), 16);
    const end = parseInt(endColor.slice(1), 16);

    const r = Math.floor((start >> 16) * (1 - percentage) + (end >> 16) * percentage);
    const g = Math.floor(((start >> 8) & 0xff) * (1 - percentage) + ((end >> 8) & 0xff) * percentage);
    const b = Math.floor((start & 0xff) * (1 - percentage) + (end & 0xff) * percentage);

    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function animateExplosion(x, y, radius) {
    const startColor = '#ff0000';
    const endColor = '#ffffff';
    const duration = 500;
    const frames = 30;

    // Use cached dimensions with bounds checking
    const colsPerRow = cachedColsPerRow || Math.ceil(window.innerWidth / charWidth);
    const maxRow = cachedRows || Math.ceil(window.innerHeight / lineHeight);
    
    // Calculate explosion position relative to ground
    const groundRow = GroundConfig.row;
    const explosionCenterY = Math.max(0, groundRow - 1); // One grid space above ground
    
    // Robust bounds checking
    const centerX = Math.floor(x / charWidth);
    const startX = Math.max(0, centerX - Math.floor(radius));
    const endX = Math.min(colsPerRow - 1, centerX + Math.ceil(radius));
    const startY = Math.max(0, explosionCenterY - Math.floor(radius));
    const endY = Math.min(groundRow, explosionCenterY + Math.ceil(radius));

    let frame = 0;
    let frameId = null;

    function drawFrame() {
        const progress = frame / frames;
        const currentRadius = radius * progress;

        const spans = window.backgroundSpans;
        if (!spans || spans.length === 0) {
            if (frameId) explosionFrames.delete(frameId);
            return;
        }
        
        for (let i = startY; i < endY && i < maxRow; i++) {
            if (i >= groundRow) continue;
            
            for (let j = startX; j < endX && j < colsPerRow; j++) {
                const distance = Math.sqrt(Math.pow(i - explosionCenterY, 2) + Math.pow(j - centerX, 2));
                
                if (distance <= currentRadius) {
                    const percentage = distance / currentRadius;
                    const color = getGradientColor(startColor, endColor, percentage);
                    const spanIndex = i * colsPerRow + j;
                    if (spanIndex >= 0 && spanIndex < spans.length) {
                        spans[spanIndex].style.color = color;
                        spans[spanIndex].setAttribute('data-explosion', 'true');
                    }
                }
            }
        }

        frame++;
        if (frame <= frames) {
            frameId = requestAnimationFrame(drawFrame);
            explosionFrames.add(frameId);
        } else {
            if (frameId) explosionFrames.delete(frameId);
            // Cleanup explosion markers
            const cleanupTimeout = setTimeout(() => {
                const currentSpans = window.backgroundSpans;
                if (!currentSpans) return;
                
                for (let i = startY; i < endY && i < maxRow; i++) {
                    if (i >= groundRow) continue;
                    
                    for (let j = startX; j < endX && j < colsPerRow; j++) {
                        const distance = Math.sqrt(Math.pow(i - explosionCenterY, 2) + Math.pow(j - centerX, 2));
                        if (distance <= radius) {
                            const spanIndex = i * colsPerRow + j;
                            if (spanIndex >= 0 && spanIndex < currentSpans.length) {
                                currentSpans[spanIndex].removeAttribute('data-explosion');
                            }
                        }
                    }
                }
            }, 200);
        }
    }

    drawFrame();
}

function replaceCharacter(row, col, color) {
    const colsPerRow = Math.ceil(window.innerWidth / charWidth);
    const spanIndex = row * colsPerRow + col;
    const spans = window.backgroundSpans || asciiBackground.querySelectorAll('span');

    if (spanIndex >= 0 && spanIndex < spans.length) {
        spans[spanIndex].style.color = color;
    }
}

// New Star class for stationary twinkling stars
class Star {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.baseRadius = 2;
        this.radius = this.baseRadius;
        this.brightness = Math.random() * 0.5 + 0.5;
        this.glowRadius = 40 + Math.random() * 20;
        
        // Calculate position in grid
        this.gridX = Math.floor(this.x / charWidth);
        this.gridY = Math.floor(this.y / lineHeight);
        
        // Random twinkle interval between 15-120 seconds
        this.twinkleInterval = (Math.random() * 105 + 15) * 1000; // 15-120 seconds in ms
        this.lastTwinkle = Date.now() + Math.random() * this.twinkleInterval; // Random start offset
        this.isTwinkling = false;
        this.twinkleDuration = 2000; // 2 second twinkle duration
        this.twinkleStart = 0;
    }

    draw() {
        // Check if it's time to twinkle
        const now = Date.now();
        if (!this.isTwinkling && now - this.lastTwinkle >= this.twinkleInterval) {
            this.isTwinkling = true;
            this.twinkleStart = now;
            this.lastTwinkle = now;
        }
        
        // Update twinkle state
        if (this.isTwinkling && now - this.twinkleStart >= this.twinkleDuration) {
            this.isTwinkling = false;
        }
        
        // Draw the star as a + symbol in the background
        this.updateBackgroundStar();
        
        // Draw glisten effects when twinkling
        if (this.isTwinkling) {
            const progress = (now - this.twinkleStart) / this.twinkleDuration;
            const twinkle = Math.sin(progress * Math.PI); // Smooth in/out
            this.drawGlistenEffect(twinkle);
        }
    }

    updateBackgroundStar() {
        const colsPerRow = cachedColsPerRow || Math.ceil(window.innerWidth / charWidth);
        const spans = window.backgroundSpans;
        if (!spans || spans.length === 0) return;
        
        const spanIndex = this.gridY * colsPerRow + this.gridX;
        
        const intensity = this.isTwinkling ? 
            (Math.sin((Date.now() - this.twinkleStart) / this.twinkleDuration * Math.PI) * 0.5 + 0.5) * this.brightness : 
            this.brightness * 0.5;
        
        const r = Math.floor(200 + intensity * 55);
        const g = Math.floor(200 + intensity * 55);
        const b = Math.floor(200 + intensity * 55);
        
        if (spanIndex >= 0 && spanIndex < spans.length) {
            // Replace | with + for the star
            spans[spanIndex].textContent = '+';
            spans[spanIndex].style.color = `rgb(${r}, ${g}, ${b})`;
            spans[spanIndex].setAttribute('data-star', 'true'); // Mark as star
        }
    }

    drawGlistenEffect(twinkle) {
        const colsPerRow = cachedColsPerRow || Math.ceil(window.innerWidth / charWidth);
        const spans = window.backgroundSpans;
        if (!spans || spans.length === 0) return;
        
        const glowIntensity = twinkle;
        const r = Math.floor(200 + glowIntensity * 55);
        const g = Math.floor(200 + glowIntensity * 55);
        const b = Math.floor(200 + glowIntensity * 55);
        const color = `rgb(${r}, ${g}, ${b})`;
        
        // Top (|)
        const topIndex = (this.gridY - 1) * colsPerRow + this.gridX;
        if (topIndex >= 0 && topIndex < spans.length && this.gridY > 0) {
            spans[topIndex].textContent = '|';
            spans[topIndex].style.color = color;
            spans[topIndex].setAttribute('data-glisten', 'true');
        }
        
        // Bottom (|)
        const bottomIndex = (this.gridY + 1) * colsPerRow + this.gridX;
        if (bottomIndex >= 0 && bottomIndex < spans.length) {
            spans[bottomIndex].textContent = '|';
            spans[bottomIndex].style.color = color;
            spans[bottomIndex].setAttribute('data-glisten', 'true');
        }
        
        // Left (-)
        const leftIndex = this.gridY * colsPerRow + (this.gridX - 1);
        if (leftIndex >= 0 && leftIndex < spans.length && this.gridX > 0) {
            spans[leftIndex].textContent = '-';
            spans[leftIndex].style.color = color;
            spans[leftIndex].setAttribute('data-glisten', 'true');
        }
        
        // Right (-)
        const rightIndex = this.gridY * colsPerRow + (this.gridX + 1);
        if (rightIndex >= 0 && rightIndex < spans.length) {
            spans[rightIndex].textContent = '-';
            spans[rightIndex].style.color = color;
            spans[rightIndex].setAttribute('data-glisten', 'true');
        }
    }
}

// Moon class
class Moon {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.glowRadius = radius * 3;
    }

    draw() {
        // Draw moon glow on background
        this.updateBackgroundGlow();
        
        // Draw the moon
        ctx.save();
        
        // Moon glow
        const gradient = ctx.createRadialGradient(this.x, this.y, this.radius * 0.8, this.x, this.y, this.radius * 2);
        gradient.addColorStop(0, 'rgba(255, 255, 230, 0.4)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 230, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 255, 230, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Moon body
        ctx.fillStyle = '#f0f0d0';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Moon craters/spots
        ctx.fillStyle = 'rgba(180, 180, 160, 0.5)';
        
        // Large crater
        ctx.beginPath();
        ctx.arc(this.x - this.radius * 0.3, this.y - this.radius * 0.2, this.radius * 0.15, 0, Math.PI * 2);
        ctx.fill();
        
        // Medium crater
        ctx.beginPath();
        ctx.arc(this.x + this.radius * 0.25, this.y + this.radius * 0.15, this.radius * 0.1, 0, Math.PI * 2);
        ctx.fill();
        
        // Small crater
        ctx.beginPath();
        ctx.arc(this.x + this.radius * 0.1, this.y - this.radius * 0.4, this.radius * 0.08, 0, Math.PI * 2);
        ctx.fill();
        
        // Another small crater
        ctx.beginPath();
        ctx.arc(this.x - this.radius * 0.15, this.y + this.radius * 0.35, this.radius * 0.07, 0, Math.PI * 2);
        ctx.fill();
        
        // Tiny crater
        ctx.beginPath();
        ctx.arc(this.x + this.radius * 0.4, this.y - this.radius * 0.1, this.radius * 0.05, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }

    updateBackgroundGlow() {
        const colsPerRow = cachedColsPerRow || Math.ceil(window.innerWidth / charWidth);
        const maxRow = cachedRows || Math.ceil(window.innerHeight / lineHeight);
        const centerX = Math.floor(this.x / charWidth);
        const centerY = Math.floor(this.y / lineHeight);
        const glowRadiusInChars = Math.ceil(this.glowRadius / Math.min(charWidth, lineHeight));
        
        const startX = Math.max(0, centerX - glowRadiusInChars);
        const endX = Math.min(colsPerRow, centerX + glowRadiusInChars);
        const startY = Math.max(0, centerY - glowRadiusInChars);
        const endY = Math.min(maxRow, centerY + glowRadiusInChars);
        
        const spans = window.backgroundSpans;
        if (!spans || spans.length === 0) return;
        
        for (let i = startY; i < endY; i++) {
            for (let j = startX; j < endX; j++) {
                const distance = Math.sqrt(Math.pow(i - centerY, 2) + Math.pow(j - centerX, 2));
                const charDistance = distance * Math.min(charWidth, lineHeight);
                
                if (charDistance <= this.glowRadius) {
                    const intensity = (1 - charDistance / this.glowRadius) * 0.3;
                    const r = Math.floor(25 + intensity * 230);
                    const g = Math.floor(25 + intensity * 230);
                    const b = Math.floor(25 + intensity * 180);
                    const color = `rgb(${r}, ${g}, ${b})`;
                    
                    const spanIndex = i * colsPerRow + j;
                    if (spanIndex >= 0 && spanIndex < spans.length) {
                        spans[spanIndex].style.color = color;
                    }
                }
            }
        }
    }
}

// Northern Lights class
class NorthernLights {
    constructor() {
        this.waves = [];
        this.numWaves = 3;
        
        // Create multiple waves
        for (let i = 0; i < this.numWaves; i++) {
            this.waves.push({
                yOffset: (canvas.height * 0.2) + (i * 60),
                speed: 0.00005 + (i * 0.00003), // Much slower speed
                amplitude: 40 + (i * 20),
                frequency: 0.002 + (i * 0.0005), // Slower frequency
                color: i === 0 ? [0, 255, 150] : i === 1 ? [50, 200, 255] : [150, 100, 255],
                offset: Math.random() * 1000
            });
        }
    }

    draw() {
        const colsPerRow = cachedColsPerRow || Math.ceil(window.innerWidth / charWidth);
        const maxRow = cachedRows || Math.ceil(canvas.height / lineHeight);
        const spans = window.backgroundSpans;
        if (!spans || spans.length === 0) return;
        
        const time = Date.now();
        
        for (let wave of this.waves) {
            const maxHeight = Math.min(maxRow, Math.ceil((wave.yOffset + wave.amplitude * 2) / lineHeight));
            const minHeight = Math.max(0, Math.floor((wave.yOffset - wave.amplitude * 2) / lineHeight));
            
            for (let i = minHeight; i < maxHeight; i++) {
                for (let j = 0; j < colsPerRow; j++) {
                    const x = j * charWidth;
                    const waveY = wave.yOffset + Math.sin((x * wave.frequency) + (time * wave.speed) + wave.offset) * wave.amplitude;
                    const currentY = i * lineHeight;
                    
                    const distanceFromWave = Math.abs(currentY - waveY);
                    
                    if (distanceFromWave < wave.amplitude) {
                        const intensity = (1 - distanceFromWave / wave.amplitude) * 0.4;
                        const flowOffset = Math.sin((x * 0.01) + (time * 0.0005) + wave.offset) * 0.2; // Slower flow
                        const finalIntensity = intensity * (0.5 + flowOffset);
                        
                        const r = Math.floor(25 + wave.color[0] * finalIntensity);
                        const g = Math.floor(25 + wave.color[1] * finalIntensity);
                        const b = Math.floor(25 + wave.color[2] * finalIntensity);
                        
                        const spanIndex = i * colsPerRow + j;
                        if (spanIndex >= 0 && spanIndex < spans.length) {
                            spans[spanIndex].style.color = `rgb(${r}, ${g}, ${b})`;
                            spans[spanIndex].setAttribute('data-aurora', 'true');
                        }
                    }
                }
            }
        }
    }
}

let textArray = [];
let stars = [];
let moon;
let northernLights;
let campfire;
let pineTree;
let pineTree2;

// Store animation frame IDs for cleanup
let explosionFrames = new Set();
let animationFrameId = null;

// Cache grid dimensions
let cachedColsPerRow = 0;
let cachedRows = 0;

function updateGridDimensions() {
    cachedColsPerRow = Math.ceil(window.innerWidth / charWidth);
    cachedRows = Math.ceil(window.innerHeight / lineHeight);
}

// Pine Tree class
class PineTree {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.gridX = Math.floor(this.x / charWidth);
        this.gridY = Math.floor(this.y / lineHeight);
        this.windPhase = Math.random() * Math.PI * 2; // Random starting phase for variety
    }
    
    draw() {
        const colsPerRow = cachedColsPerRow || Math.ceil(window.innerWidth / charWidth);
        const maxRow = cachedRows || Math.ceil(window.innerHeight / lineHeight);
        const spans = window.backgroundSpans;
        if (!spans || spans.length === 0) return;
        
        const time = Date.now();
        
        // Pine tree ASCII art using braille characters
        const treeArt = [
            '        ⢀        ',
            '      ⣰⣿⣄      ',
            '    ⢀⣼⣿⡿⣿⣦⡀    ',
            '   ⢛⣿⡛⠁⣀⠉⠻⠦   ',
            '  ⣠⣿⣿⣧⣰⣿⢿⣶⣤  ',
            '  ⣽⣿⣿⣿⡿⠃⡀⠛⠉⠃  ',
            ' ⢾⣿⣿⣿⣇⠀⣼⣿⣆⠀⣀ ',
            '⢀⣼⣿⣿⣿⣿⣼⣿⣧⠙⢷⣿⣷⣄',
            '⣠⣾⣿⣿⣿⣿⣿⣿⣿⣿⣀⡀⠙⠉',
            '⠴⢿⣿⣿⣿⠿⠟⠻⢿⣿⣿⢿⣿⡶⠛⠷⠆',
            '⢀⣾⣿⣿⣿⢀⣴⣶⣤⡈⠛⠀⣄⡉⠀⢰⡄',
            '⢠⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣤⣿⣿⣿⣶⣿⡄',
            '⠉⠉⠿⠿⠛⠋⣿⣿⡟⠿⡿⠉⠛⠿⠿⠛⠋',
            '      ⢀⣿⣿⡇      ',
            '      ⠘⠛⠛⠓      '
        ];
        
        // Draw tree with subtle wind effect
        for (let i = 0; i < treeArt.length; i++) {
            const row = this.gridY + i + 1; // Start one grid down
            if (row >= maxRow) break;
            
            const line = treeArt[i];
            
            // Very subtle wind - only top foliage moves slightly
            let windShift = 0;
            if (i < 13) { // Only foliage moves
                const rowPhase = i * 0.2; // Phase offset for each row
                const windStrength = (12 - i) / 24; // Reduced strength (was /12, now /24)
                const windSway = Math.sin(time * 0.0008 + this.windPhase + rowPhase) * 0.4; // Much slower and gentler
                windShift = Math.floor(windSway * windStrength);
            }
            
            for (let j = 0; j < line.length; j++) {
                if (line[j] === ' ') continue;
                
                const col = this.gridX + j - Math.floor(line.length / 2) + windShift;
                if (col < 0 || col >= colsPerRow) continue;
                
                const spanIndex = row * colsPerRow + col;
                
                if (spanIndex >= 0 && spanIndex < spans.length) {
                    spans[spanIndex].textContent = line[j];
                    
                    // Color: green for foliage (rows 0-12), brown for trunk (rows 13-14)
                    if (i < 13) {
                        spans[spanIndex].style.color = '#165408'; // Forest green
                    } else {
                        spans[spanIndex].style.color = '#8B4513'; // Brown
                    }
                    spans[spanIndex].setAttribute('data-tree', 'true');
                }
            }
        }
    }
}

// Campfire class
class Campfire {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.gridX = Math.floor(this.x / charWidth);
        this.gridY = Math.floor(this.y / lineHeight);
        this.smokeParticles = [];
        this.windOffset = 0;
        this.windDirection = 1;
        this.windChangeTime = Date.now() + Math.random() * 3000 + 2000; // Change direction every 2-5 seconds
    }
    
    draw() {
        const colsPerRow = cachedColsPerRow || Math.ceil(window.innerWidth / charWidth);
        const maxRow = cachedRows || Math.ceil(window.innerHeight / lineHeight);
        const spans = window.backgroundSpans;
        if (!spans || spans.length === 0) return;
        
        // Update wind direction randomly
        const now = Date.now();
        if (now > this.windChangeTime) {
            this.windDirection = (Math.random() - 0.5) * 4; // Random direction between -2 and 2
            this.windChangeTime = now + Math.random() * 3000 + 2000;
        }
        
        // Update wind offset for flame animation with random direction
        this.windOffset = Math.sin(now * 0.002) * this.windDirection;
        
        // Base campfire structure (wood and base)
        const woodArt = [
            '  .-\'..`-.',
            ' `-\'.\'`-\''
        ];
        
        // Draw wood (stationary)
        for (let i = 0; i < woodArt.length; i++) {
            const row = this.gridY + 3 + i;
            if (row >= maxRow) continue;
            
            const line = woodArt[i];
            
            for (let j = 0; j < line.length; j++) {
                if (line[j] === ' ') continue;
                
                const col = this.gridX + j - Math.floor(line.length / 2);
                if (col < 0 || col >= colsPerRow) continue;
                
                const spanIndex = row * colsPerRow + col;
                
                if (spanIndex >= 0 && spanIndex < spans.length) {
                    spans[spanIndex].textContent = line[j];
                    spans[spanIndex].style.color = '#8B4513';
                    spans[spanIndex].setAttribute('data-campfire', 'true');
                }
            }
        }
        
        // Animated flames
        const flameArt = [
            '     .(',
            '    /%/\\',
            '  (%(%))' 
        ];
        
        // Draw flames with wind effect
        for (let i = 0; i < flameArt.length; i++) {
            const row = this.gridY + i;
            if (row >= maxRow) continue;
            
            const line = flameArt[i];
            const windShift = Math.floor(this.windOffset * (3 - i) / 3); // More movement at top
            
            for (let j = 0; j < line.length; j++) {
                if (line[j] === ' ') continue;
                
                const col = this.gridX + j - Math.floor(line.length / 2) + windShift;
                if (col < 0 || col >= colsPerRow) continue;
                
                const spanIndex = row * colsPerRow + col;
                
                if (spanIndex >= 0 && spanIndex < spans.length) {
                    spans[spanIndex].textContent = line[j];
                    
                    // Animated flame colors
                    const flicker = Math.random() * 0.3 + 0.7;
                    const r = Math.floor(255 * flicker);
                    const g = Math.floor((100 + Math.random() * 50) * flicker);
                    const b = 0;
                    spans[spanIndex].style.color = `rgb(${r}, ${g}, ${b})`;
                    spans[spanIndex].setAttribute('data-campfire', 'true');
                }
            }
        }
        
        // Spawn smoke particles occasionally (reduced frequency)
        if (Math.random() < 0.02) { // Reduced from 0.1 to 0.02 (80% less smoke)
            this.smokeParticles.push({
                x: this.gridX + Math.floor(Math.random() * 3 - 1),
                y: this.gridY - 1,
                age: 0,
                maxAge: 30 + Math.random() * 20,
                drift: (Math.random() - 0.5) * 0.5
            });
        }
        
        // Update and draw smoke particles
        this.smokeParticles = this.smokeParticles.filter(particle => {
            particle.age++;
            particle.y -= 0.3;
            particle.x += particle.drift;
            
            if (particle.age >= particle.maxAge) {
                return false;
            }
            
            const smokeRow = Math.floor(particle.y);
            const smokeCol = Math.floor(particle.x);
            
            // Bounds checking
            if (smokeRow < 0 || smokeRow >= maxRow || smokeCol < 0 || smokeCol >= colsPerRow) {
                return false;
            }
            
            const smokeIndex = smokeRow * colsPerRow + smokeCol;
            
            if (smokeIndex >= 0 && smokeIndex < spans.length) {
                spans[smokeIndex].textContent = '#';
                
                // Fade smoke color based on age
                const opacity = 1 - (particle.age / particle.maxAge);
                const grayValue = Math.floor(100 + opacity * 100);
                spans[smokeIndex].style.color = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
                spans[smokeIndex].setAttribute('data-campfire', 'true');
            }
            
            return true;
        });
    }
}

function isPositionValid(x, y) {
    // Check if position overlaps with moon
    if (moon) {
        const distToMoon = Math.sqrt(Math.pow(x - moon.x, 2) + Math.pow(y - moon.y, 2));
        if (distToMoon < moon.radius + 50) return false;
    }
    
    // Check if position overlaps with logo area (center of screen)
    const logoX = canvas.width / 2;
    const logoY = canvas.height / 2;
    const distToLogo = Math.sqrt(Math.pow(x - logoX, 2) + Math.pow(y - logoY, 2));
    if (distToLogo < 200) return false; // Keep away from center logo area
    
    // Check if too close to other stars
    for (let star of stars) {
        const dist = Math.sqrt(Math.pow(x - star.x, 2) + Math.pow(y - star.y, 2));
        if (dist < 60) return false; // Minimum distance between stars
    }
    
    return true;
}

function init() {
    // Update cached grid dimensions
    updateGridDimensions();
    
    // Create stationary stars with proper spacing
    const starCount = 30;
    let attempts = 0;
    while (stars.length < starCount && attempts < 200) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * (canvas.height * 0.6); // Stars in upper 60% of screen
        
        if (isPositionValid(x, y)) {
            stars.push(new Star(x, y));
        }
        attempts++;
    }
    
    // Create moon
    moon = new Moon(canvas.width * 0.15, canvas.height * 0.2, 40);
    
    // Create northern lights
    northernLights = new NorthernLights();
    
    // Create campfire and pine trees at ground level (wait for ground level to be set)
    setTimeout(() => {
        // Position campfire at ground using the consolidated config
        campfire = new Campfire(canvas.width / 2, GroundConfig.positionAtGround(5)); // 5 rows tall
        console.log('Campfire positioned at:', GroundConfig.positionAtGround(5));
        
        // Position pine trees at ground (15 rows tall each)
        pineTree = new PineTree(canvas.width * 0.25, GroundConfig.positionAtGround(15));
        console.log('Pine tree 1 positioned at:', GroundConfig.positionAtGround(15));
        
        pineTree2 = new PineTree(canvas.width * 0.75, GroundConfig.positionAtGround(15));
        console.log('Pine tree 2 positioned at:', GroundConfig.positionAtGround(15));
    }, 200);
    
    // Function to spawn shooting stars at random intervals
    function spawnShootingStar() {
        const x = Math.random() * canvas.width;
        const y = 0;
        const dx = (Math.random() * 3 - 1.5) * 2; // More horizontal variation for sloped angle
        const dy = Math.random() * 0.5 + 0.5; // Slower initial downward velocity
        textArray.push(new TextParticle(x, y, dx, dy, '*', '30px Arial', 'yellow'));
        
        // Schedule next shooting star with random delay between 10-120 seconds
        const nextDelay = (Math.random() * 110 + 10) * 1000;
        setTimeout(spawnShootingStar, nextDelay);
    }
    
    // Start the first shooting star
    spawnShootingStar();
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Reset background characters to | with base color periodically
    resetBackgroundCharacters();
    
    // Draw northern lights first (background)
    if (northernLights) {
        northernLights.draw();
    }
    
    // Draw moon (draws after northern lights)
    if (moon) {
        moon.draw();
    }
    
    // Draw stationary stars
    stars.forEach(star => star.draw());
    
    // Draw pine trees
    if (pineTree) {
        pineTree.draw();
    }
    if (pineTree2) {
        pineTree2.draw();
    }
    
    // Draw campfire
    if (campfire) {
        campfire.draw();
    }
    
    // Update and draw shooting stars
    textArray.forEach(textParticle => textParticle.update());
    textArray = textArray.filter(textParticle => !textParticle.shouldRemove);
    
    animationFrameId = requestAnimationFrame(animate);
}

function resetBackgroundCharacters() {
    const spans = window.backgroundSpans;
    if (!spans || spans.length === 0) return;
    
    for (let i = 0; i < spans.length; i++) {
        const span = spans[i];
        
        // Skip explosion marked spans only (they manage their own lifecycle)
        if (span.hasAttribute('data-explosion')) {
            continue;
        }
        
        // Reset to | character and base color
        if (span.textContent !== '|') {
            span.textContent = '|';
        }
        span.style.color = '#191919';
        
        // Clean up temporary markers (they're redrawn each frame)
        span.removeAttribute('data-glisten');
        span.removeAttribute('data-aurora');
        span.removeAttribute('data-star');
        span.removeAttribute('data-campfire');
        span.removeAttribute('data-tree');
    }
}

init();
animate();

window.addEventListener('resize', () => {
    // Cancel ongoing animation
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // Clear explosion frames
    explosionFrames.forEach(frameId => cancelAnimationFrame(frameId));
    explosionFrames.clear();
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    generateAsciiBackground();
    
    // Note: Ground level automatically updates via GroundConfig.level getter
    
    // Recreate stars with proper spacing
    stars = [];
    const starCount = 30;
    let attempts = 0;
    while (stars.length < starCount && attempts < 200) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * (canvas.height * 0.6);
        
        if (isPositionValid(x, y)) {
            stars.push(new Star(x, y));
        }
        attempts++;
    }
    
    moon = new Moon(canvas.width * 0.15, canvas.height * 0.2, 40);
    northernLights = new NorthernLights();
    
    // Reposition campfire and trees using consolidated config
    campfire = new Campfire(canvas.width / 2, GroundConfig.positionAtGround(5));
    pineTree = new PineTree(canvas.width * 0.25, GroundConfig.positionAtGround(15));
    pineTree2 = new PineTree(canvas.width * 0.75, GroundConfig.positionAtGround(15));
    
    // Restart animation
    animate();
});