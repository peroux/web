const asciiBackground = document.querySelector('.ascii-background');

function generateAsciiBackground() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const character = '|';
    const lineHeight = 10;
    const charWidth = 5; 
    let content = '';

    for (let y = 0; y < height; y += lineHeight) {
        for (let x = 0; x < width; x += charWidth) {
            content += character;
        }
        content += '\n';
    }

    asciiBackground.textContent = content;
}

window.addEventListener('resize', generateAsciiBackground);
window.addEventListener('load', generateAsciiBackground);