const startDate = new Date('2026-05-30');
function updateUptime() {
    const now = new Date();
    const diff = now - startDate;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    document.getElementById('uptime').textContent =
        days + 'd ' + hours + 'h ' + minutes + 'm ' + seconds + 's';
}
updateUptime();
setInterval(updateUptime, 1000);
