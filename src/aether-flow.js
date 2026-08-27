/* <aether-flow> — flowing ember/aurora canvas background (brand red→orange on black). */
(function () {
  if (customElements.get('aether-flow')) return;

  class AetherFlow extends HTMLElement {
    connectedCallback() {
      if (this._init) return;
      this._init = true;
      const shadow = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = ':host{display:block;overflow:hidden}canvas{width:100%;height:100%;display:block}';
      this._canvas = document.createElement('canvas');
      shadow.appendChild(style);
      shadow.appendChild(this._canvas);

      this._blobs = [];
      const COLORS = ['#D3372B', '#F04E23', '#F49E1D', '#8C1F14', '#FFB84D'];
      for (let i = 0; i < 7; i++) {
        this._blobs.push({
          seed: Math.random() * 1000,
          spX: 0.00008 + Math.random() * 0.00012,
          spY: 0.00006 + Math.random() * 0.0001,
          phX: Math.random() * Math.PI * 2,
          phY: Math.random() * Math.PI * 2,
          r: 0.22 + Math.random() * 0.3,
          color: COLORS[i % COLORS.length],
          alpha: 0.5 + Math.random() * 0.35,
        });
      }

      this._resize = () => {
        const rect = this.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        this._canvas.width = Math.max(2, rect.width * dpr * 0.5);   // low-res for softness + perf
        this._canvas.height = Math.max(2, rect.height * dpr * 0.5);
      };
      this._ro = new ResizeObserver(this._resize);
      this._ro.observe(this);
      this._resize();

      const ctx = this._canvas.getContext('2d');
      const loop = (t) => {
        this._raf = requestAnimationFrame(loop);
        const w = this._canvas.width, h = this._canvas.height;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (const b of this._blobs) {
          const x = w * (0.5 + 0.42 * Math.sin(t * b.spX + b.phX) * Math.cos(t * b.spY * 0.7 + b.seed));
          const y = h * (0.5 + 0.42 * Math.cos(t * b.spY + b.phY) * Math.sin(t * b.spX * 0.6 + b.seed));
          const r = Math.max(w, h) * b.r * (0.85 + 0.15 * Math.sin(t * 0.0004 + b.seed));
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, b.color);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = b.alpha * 0.16;
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      };
      this._raf = requestAnimationFrame(loop);
    }

    disconnectedCallback() {
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._ro) this._ro.disconnect();
      this._init = false;
    }
  }

  customElements.define('aether-flow', AetherFlow);
})();
