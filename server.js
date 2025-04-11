const express = require('express');
const path = require('path');
const cors = require('cors');
const routes = require('./routes');

const app = express();

// Configurar EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir archivos estáticos desde la carpeta 'static'
app.use(express.static(path.join(__dirname, 'static')));

// Rutas
app.use('/', routes);

// Ruta principal
app.get('/', (req, res) => {
    res.render('index');
});

// Error handling
app.use((req, res, next) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Error interno del servidor' });
});

// Puerto
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
    console.log(`Archivos estáticos servidos desde: ${path.join(__dirname, 'static')}`);
}); 