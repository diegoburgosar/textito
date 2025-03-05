require('dotenv').config();
const express = require('express');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const fs = require('fs').promises;
const path = require('path');

// Configurar credenciales
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_CREDENTIALS_FILE;

const app = express();
const port = process.env.PORT || 4000;

console.log('Iniciando aplicación...');
console.log('Directorio actual:', __dirname);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('static'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

console.log('Middleware configurado');
console.log('Directorio de vistas:', path.join(__dirname, 'views'));

// Rutas
app.get('/', (req, res) => {
    console.log('GET / - Renderizando index');
    try {
        res.render('index');
    } catch (error) {
        console.error('Error renderizando index:', error);
        res.status(500).send('Error interno del servidor');
    }
});

app.post('/convert', async (req, res) => {
    console.log('POST /convert - Iniciando conversión');
    console.log('Body recibido:', req.body);  // Debug
    
    try {
        const text = req.body.text;
        
        if (!text) {
            console.log('No se recibió texto');
            return res.status(400).json({
                error: 'No se recibió texto para convertir'
            });
        }

        console.log('Texto recibido:', text);
        
        if (Buffer.byteLength(text, 'utf8') > 5000) {
            return res.status(400).json({
                error: 'El texto es demasiado largo. Máximo 5000 bytes.'
            });
        }

        console.log('Creando cliente Text-to-Speech');
        const client = new TextToSpeechClient();
        
        const request = {
            input: { text },
            voice: {
                languageCode: 'es-ES',
                name: 'es-ES-Standard-A',
                ssmlGender: 'FEMALE'
            },
            audioConfig: { audioEncoding: 'MP3' }
        };

        console.log('Generando audio...');
        const [response] = await client.synthesizeSpeech(request);
        
        const audioPath = path.join(__dirname, 'static', 'audio.mp3');
        console.log('Guardando audio en:', audioPath);
        
        await fs.writeFile(audioPath, response.audioContent, 'binary');
        console.log('Audio guardado correctamente');
        
        res.download(audioPath);

    } catch (error) {
        console.error('Error en /convert:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
    console.log('Variables de entorno:', {
        PORT: process.env.PORT,
        NODE_ENV: process.env.NODE_ENV,
        GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });
}); 