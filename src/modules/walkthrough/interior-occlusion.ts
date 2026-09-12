import { Color, InstancedMesh, Mesh, MeshNormalMaterial, RedFormat, SkinnedMesh, type PerspectiveCamera, type Scene, type Material, type ColorRepresentation, type WebGLRenderer, type WebGLRenderTarget } from 'three';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OCCLUSION_BLUR_FRAGMENT } from './occlusion-blur';
import { ValueSnapshot } from './value-snapshot';

/** Match the visible cutaway, not the uncut wall hidden above it. */
export class InteriorOcclusionPass extends SSAOPass {
  declare camera: PerspectiveCamera;
  private normals = new Map<Material, MeshNormalMaterial>();
  private normalDisposers = new Map<Material, () => void>();
  private snapshot = new ValueSnapshot();
  private refreshOcclusion = true;
  private externalComposite = false;
  get recomputedLastFrame(): boolean { return this.refreshOcclusion; }

  /** Leave the beauty read-buffer intact; the final output samples this AO map. */
  useOutputComposite(singleChannel=false) {
    if(singleChannel&&this.blurRenderTarget.texture.format!==RedFormat){
      for(const target of [this.ssaoRenderTarget,this.blurRenderTarget]){
        target.dispose();target.texture.format=RedFormat;
      }
      this.snapshot.invalidate();this.refreshOcclusion=true;
    }
    this.externalComposite = true;
    this.needsSwap = false;
    return this.blurRenderTarget.texture;
  }

  constructor(scene: Scene, camera: PerspectiveCamera, width: number, height: number, kernelSize = 16) {
    super(scene, camera, width, height, kernelSize);
    // Fullscreen AO/filter draws do not test depth; only the normal pass needs it.
    this.ssaoRenderTarget.depthBuffer=false;
    this.blurRenderTarget.depthBuffer=false;
    // Restrained contact shading, not a dark outline around every piece of furniture.
    this.ssaoMaterial.fragmentShader = this.ssaoMaterial.fragmentShader.replace(
      '1.0 - occlusion', '1.0 - occlusion * 0.55');
    this.blurMaterial.fragmentShader = OCCLUSION_BLUR_FRAGMENT;
    this.blurMaterial.uniforms.tDepth = { value: this.normalRenderTarget.depthTexture };
    this.blurMaterial.uniforms.cameraNear = { value: camera.near };
    this.blurMaterial.uniforms.cameraFar = { value: camera.far };
    this.setSize(width,height);
  }

  override setSize(width:number,height:number):void {
    // Keep the beauty buffer sharp; only normal/depth/AO use half resolution.
    const scale=Math.min(0.5,1024/Math.max(width,height));
    super.setSize(Math.max(1,Math.ceil(width*scale)),Math.max(1,Math.ceil(height*scale)));
    this.snapshot.invalidate();
  }

  override render(renderer:WebGLRenderer,writeBuffer:WebGLRenderTarget,readBuffer:WebGLRenderTarget,deltaTime=0,maskActive=false):void {
    this.scene.updateMatrixWorld(true);this.camera.updateMatrixWorld(true);
    const values=this.snapshot.begin();
    values.push(...this.camera.matrixWorld.elements,...this.camera.projectionMatrix.elements,
      this.kernelRadius,this.minDistance,this.maxDistance,this.noiseTexture.version);
    let dynamic=false;
    this.scene.traverseVisible(object=>{
      if(!(object instanceof Mesh))return;
      if(object instanceof SkinnedMesh || object.morphTargetInfluences?.length)dynamic=true;
      values.push(object.id,object.geometry.id,...object.matrixWorld.elements,
        object.geometry.getAttribute('position')?.version??0,object.geometry.index?.version??0,
        object.geometry.getAttribute('normal')?.version??0,
        object.geometry.drawRange.start,object.geometry.drawRange.count);
      if(object instanceof InstancedMesh)values.push(object.count,object.instanceMatrix.version);
      for(const source of Array.isArray(object.material)?object.material:[object.material]){
        values.push(source.id,source.version,source.visible,source.transparent,source.opacity,source.side,source.clipIntersection);
        for(const plane of source.clippingPlanes??[])values.push(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
      }
    });
    // Compare reusable scalar buffers, without serializing the entire scene per frame.
    // Always commit even for dynamic meshes, so the buffers have a bounded lifecycle.
    this.refreshOcclusion=this.snapshot.commit()||dynamic;
    // Camera projection can change without a canvas resize (zoom/view offsets).
    this.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix);
    this.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(this.camera.projectionMatrixInverse);
    for (const material of [this.ssaoMaterial, this.blurMaterial, this.depthRenderMaterial]) {
      material.uniforms.cameraNear.value = this.camera.near;
      material.uniforms.cameraFar.value = this.camera.far;
    }
    try {
      super.render(renderer,writeBuffer,readBuffer,deltaTime,maskActive);
    } catch(error) {
      // A failed draw did not publish a complete AO result.
      this.snapshot.invalidate();
      throw error;
    }
  }

  override renderPass(renderer:WebGLRenderer,material:Material,target:WebGLRenderTarget,
    clearColor?:ColorRepresentation,clearAlpha?:number):void {
    if(this.externalComposite && material===this.copyMaterial)return;
    if(!this.refreshOcclusion&&(material===this.ssaoMaterial||material===this.blurMaterial))return;
    super.renderPass(renderer,material,target,clearColor,clearAlpha);
  }

  override renderOverride(renderer: WebGLRenderer, _override: Material, target: WebGLRenderTarget,
    clearColor?: ColorRepresentation, clearAlpha = 1): void {
    if(!this.refreshOcclusion)return;
    const originals = new Map<Mesh, Material | Material[]>();
    const previousColor = renderer.getClearColor(new Color());
    const previousAlpha = renderer.getClearAlpha();
    const previousAutoClear = renderer.autoClear;
    const previousShadowUpdate = renderer.shadowMap.autoUpdate;
    const background = this.scene.background;
    const replacement = (source: Material) => {
      let normal = this.normals.get(source);
      if (!normal) {
        normal = new MeshNormalMaterial();
        this.normals.set(source, normal);
        const release = () => {
          this.normals.get(source)?.dispose();
          this.normals.delete(source);
          source.removeEventListener('dispose', release);
          this.normalDisposers.delete(source);
          this.snapshot.invalidate();
        };
        this.normalDisposers.set(source, release);
        source.addEventListener('dispose', release);
      }
      const planesChanged = normal.clippingPlanes !== source.clippingPlanes;
      const sideChanged = normal.side !== source.side;
      normal.clippingPlanes = source.clippingPlanes;
      normal.clipIntersection = source.clipIntersection;
      normal.side = source.side;
      // Glass and walls faded to reveal the character must not become opaque AO blockers.
      normal.visible = source.visible && !source.userData.exteriorBackdrop && !(source.transparent && source.opacity < 0.5);
      if (planesChanged || sideChanged) normal.needsUpdate = true;
      return normal;
    };
    try {
      this.scene.updateMatrixWorld(true);
      this.scene.traverseVisible(object => {
        if (!(object instanceof Mesh)) return;
        // TransformControls reads its own colour materials during matrix updates.
        // Its helper meshes are editor overlays, not room geometry.
        for (let parent = object.parent; parent; parent = parent.parent) {
          if (parent.type.startsWith('TransformControls')) return;
        }
        originals.set(object, object.material);
        object.material = Array.isArray(object.material)
          ? object.material.map(replacement) : replacement(object.material);
      });
      this.scene.background = null;
      renderer.shadowMap.autoUpdate = false;
      renderer.autoClear = false;
      renderer.setRenderTarget(target);
      renderer.setClearColor(clearColor ?? 0x7777ff, clearAlpha);
      renderer.clear();
      renderer.render(this.scene, this.camera);
    } finally {
      for (const [mesh, material] of originals) mesh.material = material;
      this.scene.background = background;
      renderer.shadowMap.autoUpdate = previousShadowUpdate;
      renderer.autoClear = previousAutoClear;
      renderer.setClearColor(previousColor, previousAlpha);
    }
  }

  override dispose(): void {
    for (const [source, release] of this.normalDisposers) source.removeEventListener('dispose', release);
    this.normalDisposers.clear();
    for (const normal of this.normals.values()) normal.dispose();
    this.normals.clear();
    this.noiseTexture.dispose();
    this.ssaoMaterial.dispose();
    super.dispose();
  }
}
