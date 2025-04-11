class AudioTranscriber {
    constructor() {
        console.log('🎤 Inicializando transcriptor de audio...');
        
        // 1. Crear el elemento del transcriptor
        const template = document.getElementById('transcriber-template');
        if (!template) {
            throw new Error('Template de transcriptor no encontrado');
        }
        
        this.element = template.content.cloneNode(true).querySelector('.transcriber');
        
        // 2. Configurar los elementos UI
        this.setupUI();
        
        // 3. Agregar al contenedor
        const container = document.querySelector('.container');
        if (!container) {
            throw new Error('Contenedor no encontrado');
        }
        container.appendChild(this.element);

        this.addEventListeners();
    }

    setupUI() {
        this.form = document.getElementById('transcribe-form');
        this.fileInput = document.getElementById('audio-file');
        this.uploadLabel = document.querySelector('.upload-label');
        this.fileName = document.querySelector('.file-name');
        this.submitBtn = document.querySelector('.submit-btn');
        this.statusContainer = document.querySelector('.transcription-status');
        this.progressFill = document.querySelector('.progress-fill');
        this.statusText = document.querySelector('.status-text');
        this.resultContainer = document.querySelector('.transcription-result');
        this.resultText = document.querySelector('.result-text');
    }

    addEventListeners() {
        // Mostrar nombre del archivo cuando se selecciona
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.fileName.textContent = file.name;
                console.log('Archivo seleccionado:', file.name);
            }
        });

        // Manejar el envío del formulario
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Formulario enviado');
            
            const file = this.fileInput.files[0];
            if (!file) {
                alert('Por favor selecciona un archivo de audio');
                return;
            }

            try {
                // Mostrar estado de carga
                this.statusContainer.style.display = 'block';
                this.submitBtn.disabled = true;
                this.resultContainer.style.display = 'none';

                console.log('Iniciando transcripción del archivo:', file.name);

                const formData = new FormData();
                formData.append('audio', file);

                const response = await fetch('/transcribe', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || data.details || 'Error en la transcripción');
                }

                // Mostrar resultado
                this.showResult(data.text);
                console.log('Transcripción completada');

            } catch (error) {
                console.error('Error en la transcripción:', error);
                this.showError(error.message);
            } finally {
                this.submitBtn.disabled = false;
            }
        });
    }

    showResult(text) {
        this.statusContainer.style.display = 'none';
        this.resultContainer.style.display = 'block';
        this.resultText.textContent = text;
    }

    showError(message) {
        this.statusContainer.style.display = 'none';
        this.resultContainer.style.display = 'block';
        this.resultText.innerHTML = `<div class="error">❌ Error: ${message}</div>`;
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('Inicializando AudioTranscriber');
    new AudioTranscriber();
});

document.addEventListener('DOMContentLoaded', () => {
    const transcribeForm = document.getElementById('transcribe-form');
    const resultDiv = document.getElementById('transcription-result');
    const fileInput = document.getElementById('audio-file');
    const uploadArea = document.querySelector('.file-upload');

    if (transcribeForm) {
        transcribeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const file = fileInput.files[0];
            if (!file) {
                alert('Por favor selecciona un archivo de audio');
                return;
            }

            try {
                // Reemplazar área de selección con progreso
                uploadArea.innerHTML = `
                    <div class="transcription-progress">
                        <div class="progress-indicator">
                            <div class="spinner"></div>
                            <div class="file-info">
                                <span class="file-name">🎤 ${file.name}</span>
                                <span class="status">Transcribiendo audio...</span>
                            </div>
                        </div>
                    </div>
                `;

                const formData = new FormData();
                formData.append('audio', file);

                console.log('Enviando archivo:', file.name, 'Tipo:', file.type, 'Tamaño:', file.size);

                const response = await fetch('/transcribe', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || data.details || 'Error desconocido');
                }

                if (data.error) {
                    throw new Error(data.error);
                }

                resultDiv.innerHTML = `
                    <div class="transcription-text">
                        <h3>Transcripción:</h3>
                        <p>${data.text}</p>
                        <button onclick="copyToClipboard(this)" class="copy-btn">
                            📋 Copiar texto
                        </button>
                    </div>
                `;

                // Restaurar área de selección
                uploadArea.innerHTML = `
                    <input type="file" 
                           id="audio-file" 
                           accept="audio/x-m4a,audio/m4a,audio/mp3,audio/wav,audio/mpeg,audio/webm,audio/aac" 
                           required>
                    <label for="audio-file" class="upload-label">
                        <span>🎤</span>
                        <span>Seleccionar archivo de audio</span>
                    </label>
                `;

            } catch (error) {
                console.error('Error completo:', error);
                resultDiv.innerHTML = `
                    <div class="error">
                        <p>Error: ${error.message}</p>
                        <p>Formatos soportados: M4A, MP3, WAV, WEBM, AAC</p>
                        <p>Tamaño máximo recomendado: 10MB</p>
                        <p>Si el archivo es muy grande, intenta dividirlo en partes más pequeñas.</p>
                    </div>
                `;

                // Restaurar área de selección en caso de error
                uploadArea.innerHTML = `
                    <input type="file" 
                           id="audio-file" 
                           accept="audio/x-m4a,audio/m4a,audio/mp3,audio/wav,audio/mpeg,audio/webm,audio/aac" 
                           required>
                    <label for="audio-file" class="upload-label">
                        <span>🎤</span>
                        <span>Seleccionar archivo de audio</span>
                    </label>
                `;
            }
        });
    }
});

function copyToClipboard(button) {
    const text = button.previousElementSibling.textContent;
    navigator.clipboard.writeText(text)
        .then(() => {
            const originalText = button.textContent;
            button.textContent = '✅ Copiado';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        })
        .catch(err => console.error('Error al copiar:', err));
} 