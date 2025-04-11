require('dotenv').config();
const express = require('express');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const path = require('path');
const multer = require('multer');
const speech = require('@google-cloud/speech');

const app = express();
const port = process.env.PORT || 4000;

// Configuración de credenciales según el entorno
let textToSpeechClient;
try {
    if (process.env.NODE_ENV === 'production') {
        textToSpeechClient = new TextToSpeechClient();
    } else {
        // Para desarrollo local
        textToSpeechClient = new TextToSpeechClient({
            keyFilename: './diegoburgos-com-8ab63a971ce9.json'
        });
    }
} catch (error) {
    console.error('Error al inicializar Text-to-Speech:', error);
}

// Inicializar el cliente de Speech-to-Text junto con el cliente de Text-to-Speech
let speechClient;
try {
    if (process.env.NODE_ENV === 'production') {
        speechClient = new speech.SpeechClient();
    } else {
        speechClient = new speech.SpeechClient({
            keyFilename: './diegoburgos-com-8ab63a971ce9.json'
        });
    }
} catch (error) {
    console.error('Error al inicializar Speech-to-Text:', error);
}

const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));
app.use(express.static('static'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Rutas
app.get('/', (req, res) => {
    try {
        res.render('index');
    } catch (error) {
        console.error('Error renderizando index:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// Función para dividir el texto en chunks
function splitTextIntoChunks(text, maxChunkSize = 1000) {
    // Asegurarse de que el texto es una cadena
    if (typeof text !== 'string') {
        return [String(text)];
    }

    // Dividir por oraciones usando una expresión regular más robusta
    const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
        // Si la oración por sí sola es más larga que maxChunkSize
        if (sentence.length > maxChunkSize) {
            // Si hay un chunk acumulado, guardarlo primero
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            
            // Dividir la oración larga en partes más pequeñas
            let remainingSentence = sentence;
            while (remainingSentence.length > 0) {
                // Buscar el último espacio antes de maxChunkSize
                const cutPoint = remainingSentence.lastIndexOf(' ', maxChunkSize);
                const chunk = remainingSentence.slice(0, cutPoint > 0 ? cutPoint : maxChunkSize);
                chunks.push(chunk.trim());
                remainingSentence = remainingSentence.slice(chunk.length);
            }
            continue;
        }

        // Proceso normal para oraciones que caben en un chunk
        if ((currentChunk + sentence).length <= maxChunkSize) {
            currentChunk += sentence;
        } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
        }
    }

    // Agregar el último chunk si existe
    if (currentChunk) chunks.push(currentChunk.trim());
    
    // Filtrar chunks vacíos y asegurar longitud mínima
    return chunks
        .filter(chunk => chunk.length > 0)
        .map(chunk => chunk.trim());
}

// Modificar la ruta /convert
app.post('/convert', async (req, res) => {
    console.log('POST /convert - Iniciando conversión');
    
    try {
        const { text } = req.body;
        if (!text || typeof text !== 'string') {
            return res.status(400).json({
                error: 'Texto inválido o no proporcionado'
            });
        }

        const byteLength = Buffer.byteLength(text, 'utf8');
        if (byteLength > 40000) {
            return res.status(400).json({
                error: 'El texto excede el límite de 40000 bytes'
            });
        }

        // Dividir el texto si es necesario
        const chunks = splitTextIntoChunks(text);
        
        // Si solo hay un chunk, enviar directamente como audio
        if (chunks.length === 1) {
            const request = {
                input: { text: chunks[0] },
                voice: {
                    languageCode: 'es-ES',
                    name: 'es-ES-Standard-A',
                    ssmlGender: 'FEMALE'
                },
                audioConfig: { audioEncoding: 'MP3' }
            };

            const [response] = await textToSpeechClient.synthesizeSpeech(request);
            
            res.set({
                'Content-Type': 'audio/mpeg',
                'Content-Length': response.audioContent.length
            }).send(response.audioContent);
            
            return;
        }

        // Si hay múltiples chunks, enviar como JSON
        const audioResults = [];
        for (let i = 0; i < chunks.length; i++) {
            const request = {
                input: { text: chunks[i] },
                voice: {
                    languageCode: 'es-ES',
                    name: 'es-ES-Standard-A',
                    ssmlGender: 'FEMALE'
                },
                audioConfig: { audioEncoding: 'MP3' }
            };

            const [response] = await textToSpeechClient.synthesizeSpeech(request);
            audioResults.push({
                audio: response.audioContent.toString('base64'),
                part: i + 1,
                total: chunks.length
            });
        }

        res.json({
            success: true,
            parts: audioResults
        });

    } catch (error) {
        console.error('Error en /convert:', error);
        res.status(500).json({ 
            error: 'Error al generar el audio',
            details: error.message 
        });
    }
});

// Agregar la nueva ruta para streaming después de la ruta /convert
app.post('/convert-stream', async (req, res) => {
    console.log('POST /convert-stream - Iniciando conversión con streaming');
    
    try {
        // Validar el body
        if (!req.body || typeof req.body.text !== 'string') {
            console.error('Error: texto inválido en el request');
            return res.status(400).send('Texto inválido');
        }

        const text = req.body.text.trim();
        
        // Validar que el texto no esté vacío
        if (!text) {
            console.error('Error: texto vacío');
            return res.status(400).send('El texto no puede estar vacío');
        }

        console.log(`Recibido texto de ${text.length} caracteres`);

        const MIN_CHUNK_LENGTH = 1000;
        const MAX_CHUNK_LENGTH = 3500;
        
        // Dividir el texto en chunks
        const chunks = [];
        let currentChunk = '';
        
        // Si el texto es más corto que el mínimo, usarlo como un solo chunk
        if (text.length < MIN_CHUNK_LENGTH) {
            chunks.push(text);
        } else {
            // Dividir por oraciones, asegurándose de que sean válidas
            const sentences = text.split(/([.!?]+)\s+/)
                                .filter(s => s && s.trim());  // Eliminar elementos vacíos
                                
            for (let i = 0; i < sentences.length; i += 2) {
                const sentence = (sentences[i] + (sentences[i + 1] || '')).trim();
                
                if (!sentence) continue;  // Saltar oraciones vacías
                
                if ((currentChunk + ' ' + sentence).length <= MAX_CHUNK_LENGTH) {
                    currentChunk += (currentChunk ? ' ' : '') + sentence;
                } else {
                    if (currentChunk) chunks.push(currentChunk);
                    currentChunk = sentence;
                }
            }
            if (currentChunk) {
                chunks.push(currentChunk);
            }
        }

        // Validar que se hayan generado chunks
        if (chunks.length === 0) {
            console.error('Error: no se generaron chunks válidos');
            return res.status(400).send('No se pudo procesar el texto');
        }

        console.log(`Chunks generados: ${chunks.length}`);
        chunks.forEach((chunk, i) => {
            const preview = chunk.substring(0, 50).replace(/[\n\r]+/g, ' ');
            console.log(`Chunk ${i+1}/${chunks.length}: ${chunk.length} caracteres`);
            console.log(`Preview: "${preview}..."`);
        });

        // Procesar cada chunk y convertirlo a audio
        let partNumber = 1;
        const totalParts = chunks.length;

        for (const chunk of chunks) {
            try {
                console.log(`⏳ Iniciando conversión del chunk ${partNumber}/${totalParts}`);
                
                const audioBuffer = await textToSpeechClient.synthesizeSpeech({
                    input: { text: chunk },
                    voice: {
                        languageCode: 'es-ES',
                        name: 'es-ES-Standard-A',
                        ssmlGender: 'FEMALE'
                    },
                    audioConfig: { audioEncoding: 'MP3' }
                });
                console.log(`✅ Audio generado para chunk ${partNumber}, tamaño: ${audioBuffer[0].audioContent.length} bytes`);
                
                const audioBase64 = audioBuffer[0].audioContent.toString('base64');
                console.log(`📤 Enviando chunk ${partNumber} al cliente`);
                
                res.write(JSON.stringify({
                    audio: audioBase64,
                    partNumber: partNumber,
                    totalParts: totalParts
                }) + '\n');

                console.log(`✅ Chunk ${partNumber} enviado correctamente`);
                partNumber++;
            } catch (error) {
                console.error(`❌ Error procesando chunk ${partNumber}:`, error);
                // Continuar con el siguiente chunk en lugar de fallar completamente
            }
        }

        res.end();

    } catch (error) {
        console.error('Error en conversión:', error);
        res.status(500).send('Error en la conversión');
    }
});

// Agregar la ruta de transcripción
app.post('/transcribe', upload.single('audio'), async (req, res) => {
    console.log('POST /transcribe - Iniciando transcripción');
    
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No se proporcionó archivo de audio'
            });
        }

        // Configurar la solicitud de transcripción
        const audio = {
            content: req.file.buffer.toString('base64')
        };

        const config = {
            encoding: 'MP3',
            sampleRateHertz: 48000,
            languageCode: 'es-AR'
        };

        const request = {
            audio: audio,
            config: config
        };

        // Realizar la transcripción
        const [response] = await speechClient.recognize(request);
        const transcription = response.results
            .map(result => result.alternatives[0].transcript)
            .join('\n');

        res.json({
            success: true,
            text: transcription
        });

    } catch (error) {
        console.error('Error en transcripción:', error);
        res.status(500).json({
            error: 'Error al transcribir el audio',
            details: error.message
        });
    }
});

// Iniciar servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
    console.log('Modo:', process.env.NODE_ENV || 'development');
}); 
