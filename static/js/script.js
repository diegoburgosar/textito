async function handleSubmit(event) {
    event.preventDefault();
    const text = textInput.value.trim();
    
    if (!text) return;

    try {
        // Mostrar progreso
        progress.style.display = 'flex';
        submitBtn.disabled = true;
        errorMessage.textContent = '';

        console.log('Enviando petición a /convert-stream...');
        const response = await fetch('/convert-stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify({ text })
        });

        console.log('Respuesta recibida:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Error response body:', errorBody);
            throw new Error(`Error HTTP ${response.status}: ${errorBody || response.statusText}`);
        }

        const reader = response.body.getReader();
        let partNumber = 1;

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log('Streaming completado');
                break;
            }

            // Procesar los chunks de datos
            const chunk = new TextDecoder().decode(value);
            console.log('Chunk recibido:', chunk.substring(0, 100) + '...');
            
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        console.log('Parte recibida:', data.partNumber, 'de', data.totalParts);
                        
                        if (data.error) {
                            throw new Error(data.error);
                        }

                        if (data.audioContent) {
                            createAudioPlayer({
                                url: `data:audio/mp3;base64,${data.audioContent}`,
                                partNumber: data.partNumber,
                                totalParts: data.totalParts
                            });
                        }
                    } catch (parseError) {
                        console.error('Error parseando JSON:', parseError);
                        console.error('Línea problemática:', line);
                        throw new Error('Error procesando la respuesta del servidor');
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error en handleSubmit:', error);
        errorMessage.textContent = `Error: ${error.message}`;
    } finally {
        progress.style.display = 'none';
        submitBtn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar el transcriptor
    try {
        new AudioTranscriber();
    } catch (error) {
        console.error('Error al inicializar el transcriptor:', error);
    }
}); 