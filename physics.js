const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const gravity = 0;
const friction = 0.9;
const { charWidth, lineHeight } = measureCharSize();

const asciiBackground = document.querySelector('.ascii-background');

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

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            content += `<span style="color: #191919;">${character}</span>`;
        }
        content += '<br>'; // Use <br> for new lines
    }

    asciiBackground.innerHTML = content;
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
        this.exploded = false; // Add a flag to track if the particle has exploded
        this.shouldRemove = false; // Add a flag to track if the particle should be removed
    }

    draw() {
        ctx.font = this.font;
        ctx.fillStyle = this.color;
        ctx.fillText(this.text, this.x, this.y);
    }

    update() {
        if (this.y + this.dy > canvas.height - lineHeight) {
            this.dy = -this.dy * friction;
            if (!this.exploded) {
                animateExplosion(this.x, this.y, 5); // Trigger an animated explosion with a radius of 5 (adjust as needed)
                this.exploded = true; // Set the exploded flag to true
                this.shouldRemove = true; // Set the flag to remove the particle immediately
            }
        } else {
            this.dy += gravity;
        }

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

    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

function animateExplosion(x, y, radius) {
    const startColor = '#ff0000'; // Start color for the explosion effect
    const endColor = '#ffffff'; // End color for the explosion effect
    const originalColor = '#191919'; // The original color of the background bars
    const duration = 500; // Total duration of the animation in milliseconds
    const frames = 30; // Number of frames for the animation

    let frame = 0;

    function drawFrame() {
        const progress = frame / frames;
        const currentRadius = radius * progress;

        const startX = Math.max(0, Math.floor(x / charWidth) - Math.floor(currentRadius));
        const endX = Math.min(Math.ceil(window.innerWidth / charWidth), Math.ceil(x / charWidth) + Math.ceil(currentRadius));
        const startY = Math.max(0, Math.floor(y / lineHeight) - Math.floor(currentRadius));
        const endY = Math.min(Math.ceil(window.innerHeight / lineHeight), Math.ceil(y / lineHeight) + Math.ceil(currentRadius));

        for (let i = startY; i < endY; i++) {
            for (let j = startX; j < endX; j++) {
                const distance = Math.sqrt(Math.pow(i - y / lineHeight, 2) + Math.pow(j - x / charWidth, 2));
                if (distance <= currentRadius) {
                    const percentage = distance / currentRadius;
                    const color = getGradientColor(startColor, endColor, percentage);
                    replaceCharacter(i, j, color);
                }
            }
        }

        frame++;
        if (frame <= frames) {
            requestAnimationFrame(drawFrame);
        } else {
            // Revert the explosion effect after the animation
            setTimeout(() => {
                for (let i = startY; i < endY; i++) {
                    for (let j = startX; j < endX; j++) {
                        const distance = Math.sqrt(Math.pow(i - y / lineHeight, 2) + Math.pow(j - x / charWidth, 2));
                        if (distance <= radius) {
                            replaceCharacter(i, j, originalColor);
                        }
                    }
                }
            }, 200); // Adjust the delay as needed
        }
    }

    drawFrame();
}

function replaceCharacter(row, col, color) {
    const colsPerRow = Math.ceil(window.innerWidth / charWidth);
    const spanIndex = row * colsPerRow + col;
    const spans = asciiBackground.querySelectorAll('span');

    if (spanIndex >= 0 && spanIndex < spans.length) {
        spans[spanIndex].style.color = color;
    } else {
        console.warn(`Invalid spanIndex: ${spanIndex}, rows: ${row}, cols: ${col}`);
    }
}

let textArray = [];

function init() {
    setInterval(() => {
        const x = Math.random() * canvas.width;
        const y = 0;
        const dx = (Math.random() - 0.5) * 4;
        const dy = Math.random() * 4;
        textArray.push(new TextParticle(x, y, dx, dy, '*', '20px Arial', 'yellow'));
    }, 1000); // Create a new star every second
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    textArray.forEach(textParticle => textParticle.update());
    textArray = textArray.filter(textParticle => !textParticle.shouldRemove); // Remove particles that should be removed
    requestAnimationFrame(animate);
}

init();
animate();

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    generateAsciiBackground();
});