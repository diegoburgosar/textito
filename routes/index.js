const express = require('express');
const router = express.Router();
const multer = require('multer');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const { SpeechClient } = require('@google-cloud/speech');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const { Readable } = require('stream');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);
const { PassThrough } = require('stream');
const { Storage } = require('@google-cloud/storage');

// Configuración de credenciales según el entorno
let textToSpeechClient;
let speechClient;
let storage;
const bucketName = 'textito-audio-files';

try {
    if (process.env.NODE_ENV === 'production') {
        textToSpeechClient = new TextToSpeechClient();
        speechClient = new SpeechClient();
        storage = new Storage();
    } else {
        textToSpeechClient = new TextToSpeechClient({
            keyFilename: './diegoburgos-com-8ab63a971ce9.json'
        });
        speechClient = new SpeechClient({
            keyFilename: './diegoburgos-com-8ab63a971ce9.json'
        });
        storage = new Storage({ keyFilename: './diegoburgos-com-8ab63a971ce9.json' });
    }
} catch (error) {
    console.error('Error al inicializar clientes:', error);
}

// Configurar ffmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Configurar multer para archivos más grandes
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB
    }
});

// Función para dividir el texto en chunks
function splitTextIntoChunks(text, maxChunkSize = 1000) {
    if (typeof text !== 'string') {
        return [String(text)];
    }

    const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
        if (sentence.length > maxChunkSize) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            
            let remainingSentence = sentence;
            while (remainingSentence.length > 0) {
                const cutPoint = remainingSentence.lastIndexOf(' ', maxChunkSize);
                const chunk = remainingSentence.slice(0, cutPoint > 0 ? cutPoint : maxChunkSize);
                chunks.push(chunk.trim());
                remainingSentence = remainingSentence.slice(chunk.length);
            }
            continue;
        }

        if ((currentChunk + sentence).length <= maxChunkSize) {
            currentChunk += sentence;
        } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
        }
    }

    if (currentChunk) chunks.push(currentChunk.trim());
    
    return chunks
        .filter(chunk => chunk.length > 0)
        .map(chunk => chunk.trim());
}

// Ruta para convertir texto a voz
router.post('/convert', async (req, res) => {
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

        const chunks = splitTextIntoChunks(text);
        
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

// Función para convertir audio a WAV
function convertToWav(inputBuffer) {
    return new Promise((resolve, reject) => {
        const inputStream = new Readable();
        inputStream.push(inputBuffer);
        inputStream.push(null);

        const outputStream = new PassThrough();
        let outputBuffer = Buffer.alloc(0);

        ffmpeg(inputStream)
            .toFormat('wav')
            .audioChannels(1)
            .audioFrequency(48000)
            .on('error', reject)
            .on('end', () => {
                resolve(outputBuffer);
            })
            .pipe()
            .on('data', chunk => {
                outputBuffer = Buffer.concat([outputBuffer, chunk]);
            });
    });
}

// Ruta para transcribir audio
router.post('/transcribe', upload.single('audio'), async (req, res) => {
    console.log('\n=== 🎤 Nueva solicitud de transcripción ===');
    
    try {
        if (!req.file) {
            console.log('❌ No se recibió archivo');
            return res.status(400).json({
                error: 'No se proporcionó archivo de audio'
            });
        }

        console.log('📁 Detalles del archivo recibido:', {
            nombre: req.file.originalname,
            tipo: req.file.mimetype,
            tamaño: `${(req.file.size / 1024 / 1024).toFixed(2)} MB`
        });

        let file;  // Movemos la declaración aquí para el manejo de errores
        try {
            // Subir archivo a GCS
            const bucket = storage.bucket(bucketName);
            const gcsFileName = `audio-${Date.now()}-${req.file.originalname}`;
            file = bucket.file(gcsFileName);

            console.log('📤 Subiendo archivo a Google Cloud Storage...');
            await file.save(req.file.buffer, {
                contentType: req.file.mimetype,
                metadata: {
                    originalname: req.file.originalname
                }
            });

            console.log('✅ Archivo subido a GCS:', `gs://${bucketName}/${gcsFileName}`);

            // Configurar la solicitud usando GCS URI
            const request = {
                audio: {
                    uri: `gs://${bucketName}/${gcsFileName}`
                },
                config: {
                    encoding: 'WEBM_OPUS',           // La codificación que funciona
                    sampleRateHertz: 48000,         // La misma tasa de muestreo
                    languageCode: 'es-AR',          // El mismo idioma
                    model: 'telephony',             // El mismo modelo
                    enableAutomaticPunctuation: true,
                    enableWordConfidence: true,     // Confianza en la palabra habilitada
                    useEnhanced: true,
                    enableSeparateRecognitionPerChannel: true  // Reconocimiento de canales independientes
                }
            };

            console.log('⚙️ Configuración de la solicitud:', JSON.stringify(request, null, 2));

            // Iniciar transcripción asíncrona
            console.log('🔄 Iniciando reconocimiento asíncrono...');
            const [operation] = await speechClient.longRunningRecognize(request);
            console.log('⏳ Operación iniciada, esperando resultados...');
            
            const [response] = await operation.promise();
            console.log('✅ Respuesta completa:', JSON.stringify(response, null, 2));
            
            if (!response.results || response.results.length === 0) {
                console.error('❌ No se obtuvieron resultados. Respuesta completa:', response);
                throw new Error('No se obtuvieron resultados de la transcripción');
            }

            const transcription = response.results
                .map(result => result.alternatives[0].transcript)
                .join('\n');

            console.log('📝 Transcripción exitosa. Longitud del texto:', transcription.length);
            
            // Limpiar: eliminar el archivo de GCS
            await file.delete();
            console.log('🗑️ Archivo temporal eliminado de GCS');

            return res.json({
                success: true,
                text: transcription
            });

        } catch (error) {
            console.error('\n=== ❌ Error en transcripción ===');
            console.error('Tipo de error:', error.constructor.name);
            console.error('Mensaje:', error.message);
            console.error('Stack:', error.stack);
            
            if (error.details) {
                console.error('Detalles adicionales:', error.details);
            }

            // Intentar limpiar el archivo en caso de error
            try {
                if (file) {
                    await file.delete();
                    console.log('🗑️ Archivo temporal eliminado después del error');
                }
            } catch (cleanupError) {
                console.error('Error al limpiar archivo:', cleanupError);
            }

            res.status(500).json({
                error: 'Error al transcribir el audio',
                details: error.message,
                type: error.constructor.name,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    } catch (error) {
        console.error('\n=== ❌ Error en transcripción ===');
        console.error('Tipo de error:', error.constructor.name);
        console.error('Mensaje:', error.message);
        console.error('Stack:', error.stack);
        
        if (error.details) {
            console.error('Detalles adicionales:', error.details);
        }

        res.status(500).json({
            error: 'Error al transcribir el audio',
            details: error.message,
            type: error.constructor.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

module.exports = router; 