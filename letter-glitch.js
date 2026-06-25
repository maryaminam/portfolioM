(function () {
  const DEFAULT_COLORS = ['#2b4539', '#61dca3', '#61b3dc'];
  const DEFAULT_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789';

  function parseColor(color) {
    if (!color) {
      return null;
    }

    if (typeof color === 'string' && color.startsWith('#')) {
      const hex = color.slice(1);
      const normalized = hex.length === 3
        ? hex.split('').map((part) => part + part).join('')
        : hex;

      if (normalized.length !== 6) {
        return null;
      }

      const value = Number.parseInt(normalized, 16);
      return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255
      };
    }

    const rgbMatch = String(color).match(/rgba?\(([^)]+)\)/i);
    if (!rgbMatch) {
      return null;
    }

    const parts = rgbMatch[1].split(',').map((part) => Number.parseFloat(part.trim()));
    if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) {
      return null;
    }

    return {
      r: parts[0],
      g: parts[1],
      b: parts[2]
    };
  }

  function interpolateColor(start, end, factor) {
    return {
      r: Math.round(start.r + (end.r - start.r) * factor),
      g: Math.round(start.g + (end.g - start.g) * factor),
      b: Math.round(start.b + (end.b - start.b) * factor)
    };
  }

  function toRgbString(color) {
    return `rgb(${color.r}, ${color.g}, ${color.b})`;
  }

  class LetterGlitchEffect {
    constructor(container, options = {}) {
      this.container = container;
      this.options = {
        glitchColors: options.glitchColors || DEFAULT_COLORS,
        glitchSpeed: options.glitchSpeed ?? 50,
        centerVignette: options.centerVignette ?? false,
        outerVignette: options.outerVignette ?? true,
        smooth: options.smooth ?? true,
        characters: options.characters || DEFAULT_CHARACTERS,
        backgroundColor: options.backgroundColor || 'transparent'
      };

      this.canvas = document.createElement('canvas');
      this.canvas.className = 'letter-glitch-canvas';
      this.context = this.canvas.getContext('2d');
      this.animationFrameId = null;
      this.resizeTimeout = null;
      this.lastGlitchTime = performance.now();
      this.letters = [];
      this.grid = { columns: 0, rows: 0 };
      this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.resizeObserver = null;

      this.lettersAndSymbols = Array.from(this.options.characters);
      this.fontSize = 16;
      this.charWidth = 10;
      this.charHeight = 20;

      this.handleResize = this.handleResize.bind(this);
      this.animate = this.animate.bind(this);

      this.mount();
    }

    getRandomChar() {
      return this.lettersAndSymbols[Math.floor(Math.random() * this.lettersAndSymbols.length)];
    }

    getRandomColor() {
      return this.options.glitchColors[Math.floor(Math.random() * this.options.glitchColors.length)];
    }

    calculateGrid(width, height) {
      return {
        columns: Math.ceil(width / this.charWidth),
        rows: Math.ceil(height / this.charHeight)
      };
    }

    initializeLetters(columns, rows) {
      this.grid = { columns, rows };
      const totalLetters = columns * rows;
      this.letters = Array.from({ length: totalLetters }, () => ({
        char: this.getRandomChar(),
        color: this.getRandomColor(),
        targetColor: this.getRandomColor(),
        colorProgress: 1
      }));
    }

    resizeCanvas() {
      const parent = this.container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      this.canvas.width = Math.max(1, Math.floor(parent.width * dpr));
      this.canvas.height = Math.max(1, Math.floor(parent.height * dpr));
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';

      this.context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const { columns, rows } = this.calculateGrid(parent.width, parent.height);
      this.initializeLetters(columns, rows);
      this.drawLetters();
    }

    drawLetters() {
      if (!this.context || this.letters.length === 0) {
        return;
      }

      const rect = this.canvas.getBoundingClientRect();
      const ctx = this.context;

      ctx.clearRect(0, 0, rect.width, rect.height);
      if (this.options.backgroundColor !== 'transparent') {
        ctx.fillStyle = this.options.backgroundColor;
        ctx.fillRect(0, 0, rect.width, rect.height);
      }

      ctx.font = `${this.fontSize}px monospace`;
      ctx.textBaseline = 'top';

      this.letters.forEach((letter, index) => {
        const x = (index % this.grid.columns) * this.charWidth;
        const y = Math.floor(index / this.grid.columns) * this.charHeight;
        ctx.fillStyle = letter.color;
        ctx.fillText(letter.char, x, y);
      });
    }

    updateLetters() {
      if (!this.letters.length) {
        return;
      }

      const updateCount = Math.max(1, Math.floor(this.letters.length * 0.05));

      for (let index = 0; index < updateCount; index += 1) {
        const letterIndex = Math.floor(Math.random() * this.letters.length);
        const letter = this.letters[letterIndex];
        if (!letter) {
          continue;
        }

        letter.char = this.getRandomChar();
        letter.targetColor = this.getRandomColor();

        if (!this.options.smooth) {
          letter.color = letter.targetColor;
          letter.colorProgress = 1;
        } else {
          letter.colorProgress = 0;
        }
      }
    }

    handleSmoothTransitions() {
      let needsRedraw = false;

      this.letters.forEach((letter) => {
        if (letter.colorProgress >= 1) {
          return;
        }

        letter.colorProgress += 0.05;
        if (letter.colorProgress > 1) {
          letter.colorProgress = 1;
        }

        const startRgb = parseColor(letter.color);
        const endRgb = parseColor(letter.targetColor);
        if (!startRgb || !endRgb) {
          return;
        }

        letter.color = toRgbString(interpolateColor(startRgb, endRgb, letter.colorProgress));
        needsRedraw = true;
      });

      if (needsRedraw) {
        this.drawLetters();
      }
    }

    animate() {
      const now = performance.now();
      if (now - this.lastGlitchTime >= this.options.glitchSpeed) {
        this.updateLetters();
        this.drawLetters();
        this.lastGlitchTime = now;
      }

      if (this.options.smooth) {
        this.handleSmoothTransitions();
      }

      this.animationFrameId = requestAnimationFrame(this.animate);
    }

    handleResize() {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
        this.resizeCanvas();
      }, 100);
    }

    mount() {
      this.container.innerHTML = '';
      this.container.appendChild(this.canvas);

      if (this.options.outerVignette) {
        this.outerVignette = document.createElement('div');
        this.outerVignette.className = 'outer-vignette';
        this.container.appendChild(this.outerVignette);
      }

      if (this.options.centerVignette) {
        this.centerVignette = document.createElement('div');
        this.centerVignette.className = 'center-vignette';
        this.container.appendChild(this.centerVignette);
      }

      this.resizeCanvas();

      if (this.isReducedMotion) {
        return;
      }

      if (window.ResizeObserver) {
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(this.container);
      } else {
        window.addEventListener('resize', this.handleResize);
      }

      this.animationFrameId = requestAnimationFrame(this.animate);
    }

    destroy() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }

      clearTimeout(this.resizeTimeout);

      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', this.handleResize);
      }
    }
  }

  window.initLetterGlitch = function initLetterGlitch(container, options) {
    if (!container) {
      return null;
    }

    return new LetterGlitchEffect(container, options);
  };
})();
