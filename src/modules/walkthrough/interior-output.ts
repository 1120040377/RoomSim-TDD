import { Color, type Texture, type WebGLRenderer, type WebGLRenderTarget } from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/** Composite the display background after tone mapping, as direct rendering does. */
export class InteriorOutputPass extends OutputPass {
  override render(renderer:WebGLRenderer,writeBuffer:WebGLRenderTarget,readBuffer:WebGLRenderTarget,deltaTime=0,maskActive=false):void {
    // A screen output never writes the composer's writeBuffer. Swapping it
    // nevertheless makes the next beauty frame allocate a second MSAA target.
    // Offscreen output still must swap so following passes see its result.
    this.needsSwap=!this.renderToScreen;
    super.render(renderer,writeBuffer,readBuffer,deltaTime,maskActive);
  }

  constructor(occlusion?: Texture) {
    super();
    this.material.uniforms.backgroundDisplay = { value: new Color() };
    this.material.uniforms.tOcclusion = { value: occlusion ?? null };
    this.material.uniforms.hasOcclusion = { value: occlusion ? 1 : 0 };
    this.material.fragmentShader = this.material.fragmentShader
      .replace('uniform sampler2D tDiffuse;', 'uniform sampler2D tDiffuse;\nuniform sampler2D tOcclusion;\nuniform float hasOcclusion;\nuniform vec3 backgroundDisplay;')
      .replace('gl_FragColor = texture2D( tDiffuse, vUv );',
        'gl_FragColor = texture2D( tDiffuse, vUv );\nif (hasOcclusion > 0.5) gl_FragColor.rgb *= texture2D(tOcclusion, vUv).r;\ngl_FragColor.rgb /= max(gl_FragColor.a, 0.00001);');
    const end = this.material.fragmentShader.lastIndexOf('}');
    this.material.fragmentShader = this.material.fragmentShader.slice(0, end) +
      'gl_FragColor.rgb = mix(backgroundDisplay, gl_FragColor.rgb, gl_FragColor.a);\ngl_FragColor.a = 1.0;\n' +
      this.material.fragmentShader.slice(end);
  }

  setBackground(color: Color): void {
    this.material.uniforms.backgroundDisplay.value.copy(color).convertLinearToSRGB();
  }
}
