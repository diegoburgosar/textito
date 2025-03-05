# Usar Node.js 18
FROM node:18-slim

# Directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto de archivos
COPY . .

# Exponer puerto
EXPOSE 8080

# Variable de entorno para el puerto
ENV PORT=8080

# Comando para ejecutar la aplicación
CMD ["npm", "start"] 