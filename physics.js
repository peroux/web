const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const gravity = 0.5; // Added gravity for shooting stars
const friction = 0.9;
const { charWidth, lineHeight } = measureCharSize();

const asciiBackground = document.querySelector('.ascii-background');
const groundLevel = canvas.height - 20; // Ground level for collision detection (closer to bottom)

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
        if (this.y + this.dy >= groundLevel) {
            if (!this.exploded) {
                animateExplosion(this.x, groundLevel, 5); // Explosion at ground level
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
    const originalColor = '#191919';
    const duration = 500;
    const frames = 30;
    const startTime = Date.now();

    // OPTIMIZATION: Pre-calculate affected area
    const colsPerRow = Math.ceil(window.innerWidth / charWidth);
    const startX = Math.max(0, Math.floor(x / charWidth) - Math.floor(radius));
    const endX = Math.min(colsPerRow, Math.ceil(x / charWidth) + Math.ceil(radius));
    const startY = Math.max(0, Math.floor(y / lineHeight) - Math.floor(radius));
    const endY = Math.min(Math.ceil(window.innerHeight / lineHeight), Math.ceil(y / lineHeight) + Math.ceil(radius));
    
    // Calculate ground row to prevent explosion going below it
    const groundRow = Math.floor(groundLevel / lineHeight);

    let frame = 0;

    function drawFrame() {
        const progress = frame / frames;
        const currentRadius = radius * progress;

        // OPTIMIZATION: Batch DOM updates
        const spans = window.backgroundSpans || asciiBackground.querySelectorAll('span');
        
        for (let i = startY; i < endY; i++) {
            // Skip rows below ground
            if (i >= groundRow) continue;
            
            for (let j = startX; j < endX; j++) {
                const distance = Math.sqrt(Math.pow(i - y / lineHeight, 2) + Math.pow(j - x / charWidth, 2));
                
                // Only draw above ground (semi-circle effect)
                if (distance <= currentRadius && i < groundRow) {
                    const percentage = distance / currentRadius;
                    const color = getGradientColor(startColor, endColor, percentage);
                    const spanIndex = i * colsPerRow + j;
                    if (spanIndex >= 0 && spanIndex < spans.length) {
                        spans[spanIndex].style.color = color;
                    }
                }
            }
        }

        frame++;
        if (frame <= frames) {
            requestAnimationFrame(drawFrame);
        } else {
            // Revert the explosion effect
            setTimeout(() => {
                for (let i = startY; i < endY; i++) {
                    if (i >= groundRow) continue;
                    
                    for (let j = startX; j < endX; j++) {
                        const distance = Math.sqrt(Math.pow(i - y / lineHeight, 2) + Math.pow(j - x / charWidth, 2));
                        if (distance <= radius && i < groundRow) {
                            const spanIndex = i * colsPerRow + j;
                            if (spanIndex >= 0 && spanIndex < spans.length) {
                                spans[spanIndex].style.color = originalColor;
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
        this.twinkleSpeed = Math.random() * 0.05 + 0.02;
        this.twinkleOffset = Math.random() * Math.PI * 2;
        this.brightness = Math.random() * 0.5 + 0.5;
        this.glowRadius = 40 + Math.random() * 20; // Glow radius
    }

    draw() {
        // Draw glow effect on background
        this.updateBackgroundGlow();
        
        // Draw the star itself
        const twinkle = Math.sin(Date.now() * this.twinkleSpeed + this.twinkleOffset) * 0.3 + 0.7;
        const alpha = this.brightness * twinkle;
        
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 200, ${alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    updateBackgroundGlow() {
        const colsPerRow = Math.ceil(window.innerWidth / charWidth);
        const centerX = Math.floor(this.x / charWidth);
        const centerY = Math.floor(this.y / lineHeight);
        const glowRadiusInChars = Math.ceil(this.glowRadius / Math.min(charWidth, lineHeight));
        
        const startX = Math.max(0, centerX - glowRadiusInChars);
        const endX = Math.min(colsPerRow, centerX + glowRadiusInChars);
        const startY = Math.max(0, centerY - glowRadiusInChars);
        const endY = Math.min(Math.ceil(window.innerHeight / lineHeight), centerY + glowRadiusInChars);
        
        const spans = window.backgroundSpans || asciiBackground.querySelectorAll('span');
        const twinkle = Math.sin(Date.now() * this.twinkleSpeed + this.twinkleOffset) * 0.3 + 0.7;
        
        for (let i = startY; i < endY; i++) {
            for (let j = startX; j < endX; j++) {
                const distance = Math.sqrt(Math.pow(i - centerY, 2) + Math.pow(j - centerX, 2));
                const charDistance = distance * Math.min(charWidth, lineHeight);
                
                if (charDistance <= this.glowRadius) {
                    const intensity = (1 - charDistance / this.glowRadius) * 0.15 * twinkle * this.brightness;
                    const r = Math.floor(25 + intensity * 100);
                    const g = Math.floor(25 + intensity * 100);
                    const b = Math.floor(25 + intensity * 50);
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
        
        ctx.restore();
    }

    updateBackgroundGlow() {
        const colsPerRow = Math.ceil(window.innerWidth / charWidth);
        const centerX = Math.floor(this.x / charWidth);
        const centerY = Math.floor(this.y / lineHeight);
        const glowRadiusInChars = Math.ceil(this.glowRadius / Math.min(charWidth, lineHeight));
        
        const startX = Math.max(0, centerX - glowRadiusInChars);
        const endX = Math.min(colsPerRow, centerX + glowRadiusInChars);
        const startY = Math.max(0, centerY - glowRadiusInChars);
        const endY = Math.min(Math.ceil(window.innerHeight / lineHeight), centerY + glowRadiusInChars);
        
        const spans = window.backgroundSpans || asciiBackground.querySelectorAll('span');
        
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

let textArray = [];
let stars = [];
let moon;

function init() {
    // Create stationary stars
    const starCount = 30;
    for (let i = 0; i < starCount; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * (canvas.height * 0.6); // Stars in upper 60% of screen
        stars.push(new Star(x, y));
    }
    
    // Create moon
    moon = new Moon(canvas.width * 0.15, canvas.height * 0.2, 40);
    
    // Create shooting stars at intervals
    setInterval(() => {
        const x = Math.random() * canvas.width;
        const y = 0;
        const dx = (Math.random() - 0.5) * 4;
        const dy = Math.random() * 2 + 2; // Faster initial downward velocity
        textArray.push(new TextParticle(x, y, dx, dy, '*', '30px Arial', 'yellow')); // Smaller shooting stars
    }, 3000); // Create a new shooting star every 3 seconds (less frequent)
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw moon (draws first so it's behind everything)
    if (moon) {
        moon.draw();
    }
    
    // Draw stationary stars
    stars.forEach(star => star.draw());
    
    // Update and draw shooting stars
    textArray.forEach(textParticle => textParticle.update());
    textArray = textArray.filter(textParticle => !textParticle.shouldRemove);
    
    requestAnimationFrame(animate);
}

init();
animate();

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    generateAsciiBackground();
    
    // Recreate stars and moon for new dimensions
    stars = [];
    const starCount = 30;
    for (let i = 0; i < starCount; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * (canvas.height * 0.6);
        stars.push(new Star(x, y));
    }
    moon = new Moon(canvas.width * 0.15, canvas.height * 0.2, 40);
});