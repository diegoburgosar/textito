import os
from google.cloud import texttospeech
from dotenv import load_dotenv

load_dotenv()

def test_credentials():
    try:
        # Obtener y establecer la ruta de las credenciales
        cred_file = os.getenv('GOOGLE_CREDENTIALS_FILE')
        print(f"Archivo de credenciales: {cred_file}")
        
        # Establecer la variable de entorno GOOGLE_APPLICATION_CREDENTIALS
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_file
        
        # Intenta crear un cliente
        client = texttospeech.TextToSpeechClient()
        print("✅ Credenciales configuradas correctamente")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_credentials() 