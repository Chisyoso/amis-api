FROM node:20-bullseye

WORKDIR /app

# 🔥 Dependencias necesarias para canvas (CLAVE)
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar dependencias
COPY package*.json ./

RUN npm install

# Copiar código
COPY . .

# Puerto
EXPOSE 8080

# Ejecutar
CMD ["node", "index.js"]