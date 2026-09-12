import {afterEach,expect,it,vi} from 'vitest';
import {MirroredRepeatWrapping,PerspectiveCamera,ShaderLib,Texture,TextureLoader} from 'three';
import {createExteriorBackdrop} from '@/modules/walkthrough/exterior-backdrop';
afterEach(()=>{vi.restoreAllMocks();});
function loader(){
  let complete:(texture:Texture)=>void=()=>{};
  const texture=new Texture({width:1774,height:887} as HTMLImageElement);
  vi.spyOn(TextureLoader.prototype,'load').mockImplementation((_url,onLoad)=>{complete=onLoad!;return texture;});
  return {texture,complete:()=>complete(texture)};
}
it('uses two triangles and world-ray photo mapping instead of camera-locked UVs',()=>{
  const fake=loader(),ready=vi.fn(),backdrop=createExteriorBackdrop(ready),camera=new PerspectiveCamera(70,1.5,.02,200);
  camera.position.set(4,2,3);camera.lookAt(0,1,0);camera.updateMatrixWorld();fake.complete();backdrop.update(camera);
  expect(backdrop.mesh.geometry.index!.count/3).toBe(2);expect(backdrop.mesh.castShadow).toBe(false);expect(backdrop.mesh.receiveShadow).toBe(false);
  expect(backdrop.mesh.material.depthWrite).toBe(false);expect(backdrop.mesh.material.userData.exteriorBackdrop).toBe(true);
  expect(backdrop.mesh.material.depthTest).toBe(true);expect(backdrop.mesh.material.transparent).toBe(false);
  expect(backdrop.mesh.renderOrder).toBe(10000);
  expect(backdrop.mesh.position.distanceTo(camera.position)).toBeCloseTo(90);
  const projected=backdrop.mesh.position.clone().project(camera);expect(projected.x).toBeCloseTo(0);expect(projected.y).toBeCloseTo(0);
  expect(fake.texture.wrapS).toBe(MirroredRepeatWrapping);
  const shader={vertexShader:ShaderLib.basic.vertexShader,fragmentShader:ShaderLib.basic.fragmentShader,uniforms:{} as Record<string,{value:number}>};
  backdrop.mesh.material.onBeforeCompile(shader as never,{} as never);
  expect(shader.vertexShader).toContain('(modelMatrix * vec4(position, 1.0)).xyz - cameraPosition');
  expect(shader.fragmentShader).toContain('texture2D( map, exteriorUv )');
  expect(shader.fragmentShader).not.toContain('texture2D( map, vMapUv )');
  expect(shader.uniforms.exteriorVerticalScale.value).toBeCloseTo(2/Math.PI);
  // Pixel density per radian must agree horizontally and vertically for a 2:1 image.
  expect(887*shader.uniforms.exteriorVerticalScale.value).toBeCloseTo(1774/Math.PI);
  expect(ready).toHaveBeenCalledOnce();backdrop.setNight(true);expect(backdrop.mesh.material.color.getHex()).not.toBe(0xffffff);
  backdrop.setNight(false);expect(backdrop.mesh.material.color.getHex()).toBe(0xffffff);backdrop.dispose();
});
it('does not resurrect the backdrop when image loading finishes after exit',()=>{
  const fake=loader(),ready=vi.fn(),backdrop=createExteriorBackdrop(ready);
  const dispose=vi.spyOn(backdrop.mesh.geometry,'dispose');backdrop.dispose();backdrop.dispose();fake.complete();
  expect(dispose).toHaveBeenCalledOnce();expect(ready).not.toHaveBeenCalled();expect(backdrop.mesh.visible).toBe(false);
});
