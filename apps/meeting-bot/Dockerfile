FROM node:22-bullseye

# Install system dependencies and Chrome
RUN apt-get update  \
    && apt-get install -y \
    build-essential \
    ca-certificates \
    cmake \
    curl \
    gdb \
    git \
    gfortran \
    libopencv-dev \
    libdbus-1-3 \
    libgbm1 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libglib2.0-dev \
    libssl-dev \
    libx11-dev \
    libx11-xcb1 \
    libxcb-image0 \
    libxcb-keysyms1 \
    libxcb-randr0 \
    libxcb-shape0 \
    libxcb-shm0 \
    libxcb-xfixes0 \
    libxcb-xtest0 \
    libgl1-mesa-dri \
    libxfixes3 \
    linux-libc-dev \
    pkgconf \
    python3-pip \
    tar \
    unzip \
    zip \
    vim \
    libpq-dev \
    pulseaudio \
    pulseaudio-utils \
    ffmpeg \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome for Testing (pinned version for compatibility)
ARG CHROME_FOR_TESTING_VERSION=139.0.7258.68
RUN mkdir -p /opt/chrome && \
    wget -q "https://storage.googleapis.com/chrome-for-testing-public/${CHROME_FOR_TESTING_VERSION}/linux64/chrome-linux64.zip" -O /tmp/chrome-linux64.zip && \
    unzip -q /tmp/chrome-linux64.zip -d /opt/chrome && \
    rm -f /tmp/chrome-linux64.zip

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

ENV HOST=0.0.0.0
ENV PORT=8000

COPY dist .

RUN pnpm install

EXPOSE 8000

CMD ["node", "main.js"]
