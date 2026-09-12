import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Color, Group, HalfFloatType, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Plane, RedFormat, RGBAFormat, Scene, Vector3, WebGLRenderTarget, type WebGLRenderer } from 'three';
import { InteriorOcclusionPass } from '@/modules/walkthrough/interior-occlusion';

describe('剖切环境遮蔽', () => {
  it('uses single-channel half floats only for the explicit WebGL2 composite path',()=>{
    const pass=new InteriorOcclusionPass(new Scene(),new PerspectiveCamera(),64,64);
    expect(pass.ssaoRenderTarget.depthBuffer).toBe(false);expect(pass.blurRenderTarget.depthBuffer).toBe(false);
    expect(pass.normalRenderTarget.depthBuffer).toBe(true);
    pass.useOutputComposite();expect(pass.blurRenderTarget.texture.format).toBe(RGBAFormat);
    const dispose=vi.spyOn(pass.blurRenderTarget,'dispose');
    pass.useOutputComposite(true);pass.useOutputComposite(true);
    expect(dispose).toHaveBeenCalledTimes(1);
    for(const target of [pass.ssaoRenderTarget,pass.blurRenderTarget]){
      expect(target.texture.format).toBe(RedFormat);expect(target.texture.type).toBe(HalfFloatType);
    }
    pass.dispose();
  });
  it('连续替换源材质时释放法线缓存，卸载后不遗留监听器', () => {
    const scene = new Scene(), mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    scene.add(mesh);
    const pass = new InteriorOcclusionPass(scene, new PerspectiveCamera(), 16, 16, 4);
    let released = vi.fn();
    const renderer = {
      getClearColor: (color: Color) => color, getClearAlpha: () => 1,
      autoClear: true, shadowMap: { autoUpdate: false },
      setRenderTarget: vi.fn(), setClearColor: vi.fn(), clear: vi.fn(),
      render: () => { mesh.material.addEventListener('dispose', released); },
    };
    for (let i = 0; i < 30; i++) {
      released = vi.fn();
      pass.renderOverride(renderer as unknown as WebGLRenderer, pass.normalMaterial, pass.normalRenderTarget);
      mesh.material.dispose();
      expect(released).toHaveBeenCalledOnce();
      mesh.material.dispose();
      expect(released).toHaveBeenCalledOnce();
      mesh.material = new MeshStandardMaterial();
    }
    released = vi.fn();
    pass.renderOverride(renderer as unknown as WebGLRenderer, pass.normalMaterial, pass.normalRenderTarget);
    pass.dispose();
    expect(released).toHaveBeenCalledOnce();
    mesh.material.dispose();
    expect(released).toHaveBeenCalledOnce();
    mesh.geometry.dispose();
  });
  it('半分辨率计算，静止时复用；相机、非投影物体移动及尺寸变化时重算',()=>{
    const scene=new Scene(),camera=new PerspectiveCamera(),mesh=new Mesh(new BoxGeometry(),new MeshStandardMaterial());scene.add(mesh);
    const pass=new InteriorOcclusionPass(scene,camera,1440,960,4);
    expect(pass.normalRenderTarget.width).toBe(720);expect(pass.normalRenderTarget.height).toBe(480);
    expect(pass.blurMaterial.uniforms.tDepth.value).toBe(pass.normalRenderTarget.depthTexture);
    const render=vi.fn();
    const renderer={capabilities:{isWebGL2:true},getClearColor:(color:Color)=>color.set('#fff'),getClearAlpha:()=>1,
      autoClear:true,shadowMap:{autoUpdate:false},setRenderTarget:vi.fn(),setClearColor:vi.fn(),setClearAlpha:vi.fn(),clear:vi.fn(),render};
    const target=new WebGLRenderTarget(16,16);
    const frame=()=>{render.mockClear();pass.render(renderer as unknown as WebGLRenderer,target,target);return render.mock.calls.length;};
    expect(frame()).toBe(5);expect(frame()).toBe(2);
    // No castShadow flag: an AO receiver still matters to normal/depth geometry.
    mesh.position.x=1;expect(frame()).toBe(5);expect(frame()).toBe(2);
    camera.position.z=2;expect(frame()).toBe(5);
    camera.near=0.05;camera.far=80;camera.updateProjectionMatrix();expect(frame()).toBe(5);
    expect(pass.blurMaterial.uniforms.cameraNear.value).toBe(0.05);
    expect(pass.blurMaterial.uniforms.cameraFar.value).toBe(80);
    pass.kernelRadius=0.3;expect(frame()).toBe(5);expect(frame()).toBe(2);
    mesh.material.clippingPlanes=[new Plane(new Vector3(0,-1,0),1)];expect(frame()).toBe(5);
    mesh.material.clippingPlanes[0].constant=0.8;expect(frame()).toBe(5);
    pass.setSize(7680,4320);expect(pass.normalRenderTarget.width).toBe(1024);expect(frame()).toBe(5);
    expect(pass.useOutputComposite()).toBe(pass.blurRenderTarget.texture);
    expect(pass.needsSwap).toBe(false);
    expect(frame()).toBe(0);
    mesh.position.x=2;expect(frame()).toBe(3);expect(frame()).toBe(0);
    // Dynamic deformation is never cached, even when transforms stay identical.
    mesh.morphTargetInfluences=[0];expect(frame()).toBe(3);expect(frame()).toBe(3);
    mesh.morphTargetInfluences=undefined;expect(frame()).toBe(0);
    mesh.position.x=3;
    render.mockImplementationOnce(()=>{throw new Error('draw failed');});
    expect(frame).toThrow('draw failed');
    expect(frame()).toBe(3);expect(frame()).toBe(0);
    mesh.material.dispose();expect(frame()).toBe(3);expect(frame()).toBe(0);
    pass.dispose();target.dispose();mesh.geometry.dispose();mesh.material.dispose();
  });
  it('沿用剖切面，排除透明玻璃，渲染后还原原材质和场景状态', () => {
    const scene = new Scene();
    scene.background = new Color('#ffffff');
    const background = scene.background;
    const wall = new MeshStandardMaterial({ clippingPlanes: [new Plane(new Vector3(0, -1, 0), 1.05)] });
    const glass = new MeshStandardMaterial({ transparent: true, opacity: 0.28 });
    const mesh = new Mesh(new BoxGeometry(), [wall, glass]);
    scene.add(mesh);
    const gizmo = new Group();
    Object.assign(gizmo, { type: 'TransformControlsGizmo' });
    const handleMaterial = new MeshBasicMaterial();
    const handle = new Mesh(mesh.geometry, handleMaterial);
    gizmo.add(handle); scene.add(gizmo);
    const pass = new InteriorOcclusionPass(scene, new PerspectiveCamera(), 16, 16, 4);
    const render = vi.fn(() => {
      const materials = mesh.material;
      expect(materials[0].clippingPlanes).toBe(wall.clippingPlanes);
      expect(materials[1].visible).toBe(false);
      expect(scene.background).toBeNull();
      expect(handle.material).toBe(handleMaterial);
    });
    const renderer = {
      getClearColor: (color: Color) => color.set('#ffffff'), getClearAlpha: () => 1,
      autoClear: true, shadowMap: { autoUpdate: true },
      setRenderTarget: vi.fn(), setClearColor: vi.fn(), clear: vi.fn(), render,
    };
    pass.renderOverride(renderer as unknown as WebGLRenderer, pass.normalMaterial, pass.normalRenderTarget);
    expect(render).toHaveBeenCalledOnce();
    expect(mesh.material).toEqual([wall, glass]);
    expect(scene.background).toBe(background);
    expect(renderer.autoClear).toBe(true);
    expect(renderer.shadowMap.autoUpdate).toBe(true);
    pass.dispose();
    mesh.geometry.dispose(); wall.dispose(); glass.dispose(); handleMaterial.dispose();
  });
});
