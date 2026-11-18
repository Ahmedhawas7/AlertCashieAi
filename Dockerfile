FROM node:20-slim

# Create user with UID 1000 for Hugging Face Spaces security
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Install dependencies
COPY --chown=user package*.json ./
RUN npm install --omit=dev

# Copy application files
COPY --chown=user . .

# Ensure session directory exists and is writable
RUN mkdir -p /home/user/app/data/whatsapp_session

# Hugging Face Spaces port is 7860
EXPOSE 7860
ENV PORT=7860
ENV HAWAS_API_URL=https://hawas-worker.hawas-alertai.workers.dev/api/chat
ENV SESSION_DIR=/home/user/app/data/whatsapp_session

CMD ["node", "scripts/whatsapp-bridge.js"]
