import { expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshStandardMaterial, PerspectiveCamera, Plane, PointLight, Scene, ShaderMaterial, Texture, Vector3 } from 'three';
import { FrameCache } from '@/modules/walkthrough/frame-cache';

function fixture(){
  const scene=new Scene(),camera=new PerspectiveCamera(),material=new MeshStandardMaterial(),mesh=new Mesh(new BoxGeometry(),material),light=new PointLight();
  scene.add(mesh,light);const cache=new FrameCache();
  const check=()=>cache.needsRender(scene,camera,[1440,960,false]);
  return {scene,camera,material,mesh,light,cache,check};
}

it('静止复用，相机、物体、灯光和显隐分别失效',()=>{
  const f=fixture();expect(f.check()).toBe(true);expect(f.check()).toBe(false);
  for(const change of [()=>f.camera.position.x++,()=>f.mesh.position.y++,()=>f.light.intensity=0,
    ()=>f.mesh.visible=false,()=>f.mesh.visible=true,()=>{f.camera.fov=35;f.camera.updateProjectionMatrix();}]){
    change();expect(f.check()).toBe(true);expect(f.check()).toBe(false);
  }
});

it('材质色彩、发光、裁切、异步纹理和 UV 变换均刷新',()=>{
  const f=fixture(),texture=new Texture();f.material.map=texture;f.check();
  for(const change of [()=>f.material.color.set('#ff0000'),()=>f.material.emissiveIntensity=.3,
    ()=>f.material.clippingPlanes=[new Plane(new Vector3(0,1,0),1)],()=>f.material.clippingPlanes![0].constant=2,
    ()=>texture.needsUpdate=true,()=>texture.offset.x=.25]){
    change();expect(f.check()).toBe(true);expect(f.check()).toBe(false);
  }
});

it('几何、场景背景、显式重置及渲染设置失效',()=>{
  const f=fixture();f.check();f.mesh.geometry.getAttribute('position').needsUpdate=true;
  expect(f.check()).toBe(true);expect(f.check()).toBe(false);
  f.scene.background=new Texture();expect(f.check()).toBe(true);
  f.cache.invalidate();expect(f.check()).toBe(true);
  expect(f.cache.needsRender(f.scene,f.camera,[800,600,true])).toBe(true);
});

it('未知自定义着色器保守地持续渲染',()=>{
  const f=fixture();f.mesh.material=new ShaderMaterial() as unknown as MeshStandardMaterial;
  expect(f.check()).toBe(true);expect(f.check()).toBe(true);
});

it('替换同版本顶点/索引缓冲也刷新，而不是只检查版本号',()=>{
  const f=fixture();f.check();
  const position=f.mesh.geometry.getAttribute('position').clone();
  expect(position.version).toBe(0);position.setX(0,2);
  f.mesh.geometry.setAttribute('position',position);
  expect(f.check()).toBe(true);expect(f.check()).toBe(false);
  f.mesh.geometry.setIndex(f.mesh.geometry.index!.clone());
  expect(f.check()).toBe(true);expect(f.check()).toBe(false);
});

it('分组绘制范围和接收阴影开关刷新',()=>{
  const f=fixture();f.check();f.mesh.geometry.groups[0].count=3;
  expect(f.check()).toBe(true);expect(f.check()).toBe(false);
  f.mesh.receiveShadow=true;expect(f.check()).toBe(true);expect(f.check()).toBe(false);
});
