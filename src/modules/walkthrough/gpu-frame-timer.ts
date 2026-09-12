/** Opt-in WebGL2 timing. Never wait for the GPU, and bound outstanding queries. */
export class GpuFrameTimer {
  private readonly ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  private pending: Array<{ query: WebGLQuery; report: (ms: number | null) => void }> = [];
  private active: WebGLQuery | null = null;
  private disposed = false;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.ext = typeof gl.createQuery === 'function' ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : null;
  }

  get supported(): boolean { return !!this.ext; }

  poll(): boolean {
    if (!this.ext || this.disposed || this.active || this.gl.isContextLost()) return false;
    const gl = this.gl;
    if (gl.getParameter(this.ext.GPU_DISJOINT_EXT)) {
      this.clearPending();
      return false;
    }
    while (this.pending.length && gl.getQueryParameter(this.pending[0].query, gl.QUERY_RESULT_AVAILABLE)) {
      const { query, report: completed } = this.pending.shift()!;
      const ms = Number(gl.getQueryParameter(query, gl.QUERY_RESULT)) / 1e6;
      gl.deleteQuery(query);
      completed(Number.isFinite(ms) && ms >= 0 ? ms : null);
    }
    return true;
  }

  begin(report: (ms: number | null) => void): boolean {
    if(!this.poll()||!this.ext)return false;
    const gl=this.gl;
    if (this.pending.length >= 4) return false;
    const query = gl.createQuery();
    if (!query) return false;
    gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
    this.active = query;
    this.pending.push({ query, report });
    return true;
  }

  end(): void {
    if (!this.active || !this.ext) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.active = null;
  }

  private clearPending(): void {
    for (const { query, report } of this.pending) { this.gl.deleteQuery(query); report(null); }
    this.pending = [];
  }

  dispose(): void {
    this.end();
    this.clearPending();
    this.disposed = true;
  }
}
