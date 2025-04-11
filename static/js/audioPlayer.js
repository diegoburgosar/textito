class AudioPlayer {
    constructor({ url, partNumber = null, totalParts = null }) {
        console.log('🎵 Creando nuevo reproductor...', { url, partNumber, totalParts });
        
        if (!url) {
            throw new Error('URL no válida para el reproductor de audio');
        }

        // 1. Crear el elemento del reproductor
        const template = document.getElementById('audio-player-template');
        if (!template) {
            throw new Error('Template no encontrado');
        }
        
        this.element = template.content.cloneNode(true).querySelector('.audio-player');
        
        // 2. Si hay múltiples partes, agregar el título
        if (partNumber !== null && totalParts !== null) {
            const title = document.createElement('h3');
            title.className = 'part-title';
            title.textContent = `Parte ${partNumber} de ${totalParts}`;
            this.element.insertBefore(title, this.element.firstChild);
        }

        // 3. Inicializar el audio con la URL
        console.log('Creando Audio con URL:', url);
        this.audio = new Audio(url);
        
        // 4. Configurar los elementos UI
        this.setupUI();
        
        // 5. Agregar al contenedor
        const container = document.querySelector('.audio-players-container');
        if (!container) {
            throw new Error('Contenedor de reproductores no encontrado');
        }
        container.appendChild(this.element);
    }

    setupUI() {
        // Elementos UI
        this.playPauseBtn = this.element.querySelector('.play-pause');
        this.currentTimeEl = this.element.querySelector('.current-time');
        this.totalTimeEl = this.element.querySelector('.total-time');
        this.progressFill = this.element.querySelector('.progress-fill');
        this.rewindBtn = this.element.querySelector('.rewind');
        this.forwardBtn = this.element.querySelector('.forward');
        this.speedBtns = this.element.querySelectorAll('.speed-btn');

        // Verificar que todos los elementos existen
        if (!this.playPauseBtn || !this.currentTimeEl || !this.totalTimeEl || 
            !this.progressFill || !this.rewindBtn || !this.forwardBtn) {
            console.error('No se encontraron todos los elementos UI necesarios');
            return;
        }

        // Event listeners
        this.playPauseBtn.addEventListener('click', () => this.togglePlay());
        this.rewindBtn.addEventListener('click', () => this.seek(-15));
        this.forwardBtn.addEventListener('click', () => this.seek(15));
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => this.updateTotalTime());
        
        // Speed buttons
        this.speedBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const speed = parseFloat(btn.dataset.speed);
                this.setSpeed(speed);
                this.speedBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
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
    }

    updateProgress() {
        const progress = (this.audio.currentTime / this.audio.duration) * 100;
        this.progressFill.style.width = `${progress}%`;
        this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
    }

    updateTotalTime() {
        this.totalTimeEl.textContent = this.formatTime(this.audio.duration);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
} 