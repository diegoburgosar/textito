import os
from flask import Flask, render_template, request, send_file, jsonify
from google.cloud import texttospeech
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Verificar que tenemos las credenciales
if not os.getenv('GOOGLE_CREDENTIALS_FILE'):
    raise ValueError("No se encontró el archivo de credenciales en .env")

# Configurar las credenciales de forma segura
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.getenv('GOOGLE_CREDENTIALS_FILE')

app = Flask(__name__)

# Constantes
MAX_BYTES = 5000

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/convert', methods=['POST'])
def convert():
    try:
        text = request.form.get('text', '')
        
        # Verificar longitud del texto
        if len(text.encode('utf-8')) > MAX_BYTES:
            return jsonify({
                'error': f'El texto es demasiado largo. Máximo {MAX_BYTES} bytes.'
            }), 400
        
        # Crear el cliente
        client = texttospeech.TextToSpeechClient()
        
        # Configurar la entrada
        synthesis_input = texttospeech.SynthesisInput(text=text)
        
        # Configurar la voz
        voice = texttospeech.VoiceSelectionParams(
            language_code='es-ES',
            name='es-ES-Standard-A',
            ssml_gender=texttospeech.SsmlVoiceGender.FEMALE
        )
        
        # Configurar el audio
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3
        )
        
        # Realizar la síntesis
        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config
        )
        
        # Guardar el archivo de audio
        audio_path = 'static/audio.mp3'
        with open(audio_path, 'wb') as out:
            out.write(response.audio_content)
            
        return send_file(audio_path, as_attachment=True)
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
