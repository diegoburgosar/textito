class AudioPlayer {
    constructor() {
        this.audio = new Audio();
        this.isPlaying = false;
        this.currentSpeed = 1;
        
        // Elementos UI
        this.container = document.getElementById('audio-player');
        this.playPauseBtn = this.container.querySelector('.play-pause');
        this.rewindBtn = this.container.querySelector('.rewind');
        this.forwardBtn = this.container.querySelector('.forward');
        this.speedBtns = this.container.querySelectorAll('.speed-btn');
        this.progressBar = this.container.querySelector('.progress-track');
        this.progressFill = this.container.querySelector('.progress-fill');
        this.currentTimeEl = document.getElementById('current-time');
        this.totalTimeEl = document.getElementById('total-time');

        // Bind events
        this.bindEvents();
    }

    bindEvents() {
        // Play/Pause
        this.playPauseBtn.addEventListener('click', () => this.togglePlay());

        // Seek buttons
        this.rewindBtn.addEventListener('click', () => this.seek(-15));
        this.forwardBtn.addEventListener('click', () => this.seek(15));

        // Speed buttons
        this.speedBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const speed = parseFloat(btn.dataset.speed);
                this.setSpeed(speed);
                this.speedBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Progress bar
        this.progressBar.addEventListener('click', (e) => {
            const rect = this.progressBar.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            this.audio.currentTime = pos * this.audio.duration;
        });

        // Audio events
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => this.updateTotalTime());
        this.audio.addEventListener('ended', () => {
            this.isPlaying = false;
            this.playPauseBtn.textContent = '▶';
        });
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    setAudio(url) {
        this.audio.src = url;
        this.audio.load();
        this.container.style.display = 'block';
        this.playPauseBtn.textContent = '▶';
        this.isPlaying = false;
    }

    togglePlay() {
        if (this.isPlaying) {
            this.audio.pause();
            this.playPauseBtn.textContent = '▶';
        } else {
            this.audio.play();
            this.playPauseBtn.textContent = '⏸';
        }
        this.isPlaying = !this.isPlaying;
    }

    seek(seconds) {
        this.audio.currentTime = Math.max(0, 
            Math.min(this.audio.duration, this.audio.currentTime + seconds));
    }

    setSpeed(speed) {
        this.audio.playbackRate = speed;
        this.currentSpeed = speed;
    }

    updateProgress() {
        const progress = (this.audio.currentTime / this.audio.duration) * 100;
        this.progressFill.style.width = `${progress}%`;
        this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
    }

    updateTotalTime() {
        this.totalTimeEl.textContent = this.formatTime(this.audio.duration);
    }
}

// Crear instancia global
window.audioPlayer = new AudioPlayer(); 