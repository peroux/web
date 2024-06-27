const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const gravity = 0;
const friction = 0.9;

class TextParticle {
    constructor(x, y, dx, dy, text, font, color) {
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.text = text;
        this.font = font;
        this.color = color;
    }

    draw() {
        ctx.font = this.font;
        ctx.fillStyle = this.color;
        ctx.fillText(this.text, this.x, this.y);
    }

    update() {
        if (this.y + this.dy > canvas.height || this.y + this.dy < 0) {
            this.dy = -this.dy * friction;
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

const textArray = [];

function init() {
    textArray.push(new TextParticle(100, 100, 2, 2, 'Hello', '30px Arial', 'red'));
    textArray.push(new TextParticle(200, 200, -2, -1, 'World', '30px ', 'blue'));
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    textArray.forEach(textParticle => textParticle.update());
    requestAnimationFrame(animate);
}

init();
animate();

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});