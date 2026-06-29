(function () {
  class ScrollStack {
    constructor(container, options) {
      this.container = container;
      this.options = {
        itemDistance: 100,
        itemScale: 0.03,
        itemStackDistance: 30,
        stackPosition: '20%',
        scaleEndPosition: '10%',
        baseScale: 0.85,
        scaleDuration: 0.5,
        rotationAmount: 0,
        blurAmount: 0,
        useWindowScroll: false,
        onStackComplete: undefined,
        itemSelector: '.scroll-stack-card',
        ...options
      };

      this.stackCompleted = false;
      this.animationFrameId = null;
      this.lenis = null;
      this.cards = [];
      this.lastTransforms = new Map();
      this.isUpdating = false;
      this.endElement = null;

      this.handleResize = this.handleResize.bind(this);
      this.handleScroll = this.handleScroll.bind(this);
      this.updateCardTransforms = this.updateCardTransforms.bind(this);

      this.init();
    }

    calculateProgress(scrollTop, start, end) {
      if (scrollTop < start) return 0;
      if (scrollTop > end) return 1;
      return (scrollTop - start) / (end - start);
    }

    parsePercentage(value, containerHeight) {
      if (typeof value === 'string' && value.includes('%')) {
        return (Number.parseFloat(value) / 100) * containerHeight;
      }
      return Number.parseFloat(value);
    }

    getScrollData() {
      if (this.options.useWindowScroll) {
        return {
          scrollTop: window.scrollY,
          containerHeight: window.innerHeight,
          scrollContainer: document.documentElement
        };
      }

      return {
        scrollTop: this.container.scrollTop,
        containerHeight: this.container.clientHeight,
        scrollContainer: this.container
      };
    }

    getElementOffset(element) {
      if (this.options.useWindowScroll) {
        const rect = element.getBoundingClientRect();
        return rect.top + window.scrollY;
      }

      return element.offsetTop;
    }

    updateCardTransforms() {
      if (!this.cards.length || this.isUpdating) return;

      this.isUpdating = true;

      const { scrollTop, containerHeight } = this.getScrollData();
      const stackPositionPx = this.parsePercentage(this.options.stackPosition, containerHeight);
      const scaleEndPositionPx = this.parsePercentage(this.options.scaleEndPosition, containerHeight);
      const endElementTop = this.endElement ? this.getElementOffset(this.endElement) : 0;

      this.cards.forEach((card, index) => {
        const cardTop = this.getElementOffset(card);
        const triggerStart = cardTop - stackPositionPx - this.options.itemStackDistance * index;
        const triggerEnd = cardTop - scaleEndPositionPx;
        const pinStart = cardTop - stackPositionPx - this.options.itemStackDistance * index;
        const pinEnd = endElementTop - containerHeight / 2;

        const scaleProgress = this.calculateProgress(scrollTop, triggerStart, triggerEnd);
        const targetScale = this.options.baseScale + index * this.options.itemScale;
        const scale = 1 - scaleProgress * (1 - targetScale);
        const rotation = this.options.rotationAmount
          ? index * this.options.rotationAmount * scaleProgress
          : 0;

        let blur = 0;
        if (this.options.blurAmount) {
          let topCardIndex = 0;
          for (let j = 0; j < this.cards.length; j += 1) {
            const jCardTop = this.getElementOffset(this.cards[j]);
            const jTriggerStart = jCardTop - stackPositionPx - this.options.itemStackDistance * j;
            if (scrollTop >= jTriggerStart) {
              topCardIndex = j;
            }
          }

          if (index < topCardIndex) {
            const depthInStack = topCardIndex - index;
            blur = Math.max(0, depthInStack * this.options.blurAmount);
          }
        }

        let translateY = 0;
        const isPinned = scrollTop >= pinStart && scrollTop <= pinEnd;

        if (isPinned) {
          translateY = scrollTop - cardTop + stackPositionPx + this.options.itemStackDistance * index;
        } else if (scrollTop > pinEnd) {
          translateY = pinEnd - cardTop + stackPositionPx + this.options.itemStackDistance * index;
        }

        const nextTransform = {
          translateY: Math.round(translateY * 100) / 100,
          scale: Math.round(scale * 1000) / 1000,
          rotation: Math.round(rotation * 100) / 100,
          blur: Math.round(blur * 100) / 100
        };

        const previousTransform = this.lastTransforms.get(index);
        const hasChanged =
          !previousTransform ||
          Math.abs(previousTransform.translateY - nextTransform.translateY) > 0.1 ||
          Math.abs(previousTransform.scale - nextTransform.scale) > 0.001 ||
          Math.abs(previousTransform.rotation - nextTransform.rotation) > 0.1 ||
          Math.abs(previousTransform.blur - nextTransform.blur) > 0.1;

        if (hasChanged) {
          const transform = `translate3d(0, ${nextTransform.translateY}px, 0) scale(${nextTransform.scale}) rotate(${nextTransform.rotation}deg)`;
          const filter = nextTransform.blur > 0 ? `blur(${nextTransform.blur}px)` : '';

          card.style.transform = transform;
          card.style.filter = filter;

          this.lastTransforms.set(index, nextTransform);
        }

        if (index === this.cards.length - 1) {
          const isInView = scrollTop >= pinStart && scrollTop <= pinEnd;
          if (isInView && !this.stackCompleted) {
            this.stackCompleted = true;
            if (typeof this.options.onStackComplete === 'function') {
              this.options.onStackComplete();
            }
          } else if (!isInView && this.stackCompleted) {
            this.stackCompleted = false;
          }
        }
      });

      this.isUpdating = false;
    }

    handleScroll() {
      this.updateCardTransforms();
    }

    setupLenis() {
      if (!window.Lenis) {
        if (this.options.useWindowScroll) {
          window.addEventListener('scroll', this.handleScroll, { passive: true });
        } else {
          this.container.addEventListener('scroll', this.handleScroll, { passive: true });
        }
        return;
      }

      if (this.options.useWindowScroll) {
        this.lenis = new window.Lenis({
          duration: 1.8,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smoothWheel: true,
          touchMultiplier: 1.3,
          infinite: false,
          wheelMultiplier: 0.8,
          lerp: 0.075,
          syncTouch: true,
          syncTouchLerp: 0.06
        });
      } else {
        const inner = this.container.querySelector('.scroll-stack-inner');

        this.lenis = new window.Lenis({
          wrapper: this.container,
          content: inner,
          duration: 1.8,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smoothWheel: true,
          touchMultiplier: 1.3,
          infinite: false,
          normalizeWheel: true,
          wheelMultiplier: 0.8,
          touchInertiaMultiplier: 24,
          lerp: 0.075,
          syncTouch: true,
          syncTouchLerp: 0.06,
          touchInertia: 0.6
        });
      }

      this.lenis.on('scroll', this.handleScroll);

      const raf = (time) => {
        this.lenis.raf(time);
        this.animationFrameId = requestAnimationFrame(raf);
      };

      this.animationFrameId = requestAnimationFrame(raf);
    }

    init() {
      this.cards = Array.from(this.container.querySelectorAll(this.options.itemSelector));
      this.endElement = this.container.querySelector('.scroll-stack-end');

      this.cards.forEach((card, index) => {
        if (index < this.cards.length - 1) {
          card.style.marginBottom = `${this.options.itemDistance}px`;
        }

        card.style.willChange = 'transform, filter';
        card.style.transformOrigin = 'top center';
        card.style.backfaceVisibility = 'hidden';
        card.style.perspective = '1000px';
        card.style.transition = `transform ${this.options.scaleDuration}s ease-out, filter ${this.options.scaleDuration}s ease-out`;
      });

      this.setupLenis();
      this.updateCardTransforms();
      window.addEventListener('resize', this.handleResize, { passive: true });
    }

    handleResize() {
      this.updateCardTransforms();
    }

    destroy() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }

      if (this.lenis) {
        this.lenis.destroy();
      } else if (this.options.useWindowScroll) {
        window.removeEventListener('scroll', this.handleScroll);
      } else {
        this.container.removeEventListener('scroll', this.handleScroll);
      }

      window.removeEventListener('resize', this.handleResize);
      this.cards = [];
      this.lastTransforms.clear();
      this.stackCompleted = false;
      this.isUpdating = false;
    }
  }

  window.ScrollStack = ScrollStack;
  window.initScrollStack = function initScrollStack(container, options) {
    if (!container) {
      return null;
    }

    return new ScrollStack(container, options);
  };
})();
