document.getElementById('theme-toggle').addEventListener('click', function () {
    const body = document.body;
    if (body.classList.contains('light-theme')) {
        body.classList.remove('light-theme');
        body.classList.add('dark-theme');
        this.textContent = 'Switch to Light Theme';
    } else {
        body.classList.remove('dark-theme');
        body.classList.add('light-theme');
        this.textContent = 'Switch to Dark Theme';
    }
});
