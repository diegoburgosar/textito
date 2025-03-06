require('dotenv').config();
const express = require('express');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const path = require('path');

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

// Middleware
app.use(express.json({limit: '10mb'}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
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

app.post('/convert', async (req, res) => {
    console.log('POST /convert - Iniciando conversión');
    
    try {
        const { text } = req.body;
        console.log('Texto recibido:', text);
        
        if (!text || typeof text !== 'string') {
            return res.status(400).json({
                error: 'Texto inválido o no proporcionado'
            });
        }

        const byteLength = Buffer.byteLength(text, 'utf8');
        console.log('Longitud en bytes:', byteLength);
        
        if (byteLength > 5000) {
            return res.status(400).json({
                error: 'El texto excede el límite de 5000 bytes'
            });
        }

        // Configurar la solicitud
        const request = {
            input: { text },
            voice: {
                languageCode: 'es-ES',
                name: 'es-ES-Standard-A',
                ssmlGender: 'FEMALE'
            },
            audioConfig: { audioEncoding: 'MP3' }
        };

        // Generar el audio
        console.log('Generando audio...');
        const [response] = await textToSpeechClient.synthesizeSpeech(request);
        console.log('Audio generado correctamente');

        // Enviar la respuesta
        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': response.audioContent.length
        }).send(response.audioContent);

    } catch (error) {
        console.error('Error en /convert:', error);
        res.status(500).json({ 
            error: 'Error al generar el audio',
            details: error.message 
        });
    }
});

// Iniciar servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
    console.log('Modo:', process.env.NODE_ENV || 'development');
}); 