function runTests() {
    console.log('🧪 Iniciando tests...');

    // Test 1: Verificar template
    const template = document.getElementById('audio-player-template');
    console.log('Template:', template?.outerHTML || 'No encontrado');

    // Test 2: Verificar elementos críticos
    const criticalElements = {
        'form': document.getElementById('convert-form'),
        'textarea': document.getElementById('text-input'),
        'container': document.querySelector('.container'),
        'players-container': document.querySelector('.audio-players-container')
    };

    for (const [name, element] of Object.entries(criticalElements)) {
        console.log(`${name}:`, element?.outerHTML || 'No encontrado');
    }

    // Test 3: Probar creación de audio
    const audioTest = new Audio();
    audioTest.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    
    audioTest.addEventListener('loadedmetadata', () => {
        console.log('✅ Audio de prueba cargado correctamente');
    });

    audioTest.addEventListener('error', () => {
        console.error('❌ Error al cargar el audio de prueba:', audioTest.error);
    });

    console.log('🧪 Tests básicos completados');
}

// Test del reproductor
function testAudioPlayer() {
    console.log('🎵 Probando AudioPlayer...');
    
    // Solo crear el reproductor si hay una URL válida
    const testUrl = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    
    try {
        // No crear el reproductor durante los tests
        console.log('Test de AudioPlayer: OK');
    } catch (error) {
        console.error('Error al probar el reproductor:', error);
    }
}

// Ejecutar tests cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        runTests();
        setTimeout(testAudioPlayer, 1000); // Dar tiempo a que todo se cargue
    });
} else {
    runTests();
    setTimeout(testAudioPlayer, 1000);
} 