import {expect,it,vi} from 'vitest';
import {Mesh,MeshBasicMaterial,PointLight,Scene,Vector2,type WebGLRenderer} from 'three';
import {prepareRender,preparationBatches,prepareRenderBatch} from '@/modules/walkthrough/prepare-render';

it('groups shared materials but keeps child meshes and lights independent of excluded parents',()=>{
  const scene=new Scene(),parent=new Mesh(),child=new Mesh(),sibling=new Mesh(),hidden=new Mesh(),light=new PointLight();
  sibling.material=child.material;hidden.visible=false;
  parent.add(child,light);scene.add(parent,sibling,hidden);parent.layers.mask=7;
  const batches=preparationBatches(scene);
  expect(batches).toEqual([[parent],[child,sibling]]);
  const renderer={getSize:(v:Vector2)=>v.set(800,600),setSize:vi.fn()};
  const draw=()=>{
    expect(parent.visible).toBe(true);expect(parent.layers.mask).toBe(0);
    expect(child.layers.mask).toBe(1);expect(light.layers.mask).toBe(1);
    throw new Error('failed batch');
  };
  expect(()=>prepareRenderBatch(renderer as unknown as WebGLRenderer,scene,batches[1],draw,vi.fn())).toThrow('failed batch');
  expect(parent.layers.mask).toBe(7);expect(child.layers.mask).toBe(1);expect(light.layers.mask).toBe(1);
  expect(hidden.visible).toBe(false);
  for(const mesh of [parent,child,hidden]){mesh.geometry.dispose();(mesh.material as MeshBasicMaterial).dispose();}
  sibling.geometry.dispose();
});

it.each([false,true])('restores resolution/culling even when preparation throws: %s',failure=>{
  const scene=new Scene(),first=new Mesh(),second=new Mesh();second.frustumCulled=false;scene.add(first,second);
  const size=new Vector2(1440,960),setSize=vi.fn((w:number,h:number)=>{size.set(w,h);});
  const renderer={getSize:(v:Vector2)=>v.copy(size),setSize};
  const resize=vi.fn();
  const draw=()=>{
    expect(size.toArray()).toEqual([1,1]);expect(first.frustumCulled).toBe(false);expect(second.frustumCulled).toBe(false);
    if(failure)throw new Error('driver failure');
  };
  const run=()=>prepareRender(renderer as unknown as WebGLRenderer,scene,draw,resize);
  if(failure)expect(run).toThrow('driver failure');else run();
  expect(first.frustumCulled).toBe(true);expect(second.frustumCulled).toBe(false);
  expect(size.toArray()).toEqual([1440,960]);
  expect(setSize.mock.calls).toEqual([[1,1,false],[1440,960,false]]);
  expect(resize.mock.calls).toEqual([[1,1],[1440,960]]);
});
