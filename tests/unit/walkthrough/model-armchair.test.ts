import { afterEach,describe,expect,it,vi } from 'vitest';
import { Box3,BoxGeometry,Group,Mesh,MeshStandardMaterial,Texture,Vector3 } from 'three';
const {load}=vi.hoisted(()=>({load:vi.fn()}));
vi.mock('three/addons/loaders/GLTFLoader.js',()=>({GLTFLoader:class{loadAsync=load;register(){return this;}}}));
vi.mock('@/modules/walkthrough/builders/texture-source-pool',()=>({loadSharedTexture:()=>new Texture()}));
import {buildModelArmchair,prepareArmchairModel,releaseArmchairModel,omitReplacedLeatherMaps,cushionOcclusionTexture} from '@/modules/walkthrough/builders/furniture/model-armchair';
const furniture={id:'chair',type:'armchair' as const,position:{x:0,y:0},rotation:0,size:{width:82,height:100,depth:98},color:'#d9cfbc'};
function asset(){
  const scene=new Group();
  const wood=new MeshStandardMaterial({map:new Texture()});wood.name='legs';
  const pillow=new MeshStandardMaterial({normalMap:new Texture()});pillow.name='pillow';
  const frame=new Mesh(new BoxGeometry(2,2,2),wood);frame.position.y=1;scene.add(frame);
  const cushion=new Mesh(new BoxGeometry(1,1,1),pillow);cushion.position.set(0,1,.3);scene.add(cushion);
  return {scene};
}
afterEach(()=>{releaseArmchairModel();load.mockReset();vi.useRealTimers();});
describe('imported armchair lifecycle',()=>{
  it('loads a cushion-only package and upgrades to a full chair when requested',async()=>{
    load.mockResolvedValueOnce(asset()).mockResolvedValueOnce(asset());
    expect(await prepareArmchairModel(true)).toBe(true);
    expect(load.mock.calls[0][0]).toMatch(/cushions\.gltf$/);
    expect(buildModelArmchair(new Group(),furniture)).toBe(false);
    expect(await prepareArmchairModel()).toBe(true);
    expect(load.mock.calls[1][0]).toMatch(/modern_arm_chair_01_1k\.gltf$/);
    expect(buildModelArmchair(new Group(),furniture)).toBe(true);
    expect(await prepareArmchairModel(true)).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('samples baked occlusion in glTF atlas UV space without color conversion',()=>{
    const texture=cushionOcclusionTexture();
    expect(texture.flipY).toBe(false);expect(texture.channel).toBe(0);expect(texture.colorSpace).toBe('');
  });
  it('omits only the replaced leather dependencies',()=>{
    const wood={name:'legs',pbrMetallicRoughness:{baseColorTexture:{index:1},metallicRoughnessTexture:{index:2}}};
    const pillow={name:'pillow',normalTexture:{index:3},pbrMetallicRoughness:{baseColorTexture:{index:4},metallicRoughnessTexture:{index:5}}};
    omitReplacedLeatherMaps({materials:[wood,pillow]});
    expect(pillow.pbrMetallicRoughness).toEqual({});expect(pillow.normalTexture).toEqual({index:3});
    expect(wood.pbrMetallicRoughness.baseColorTexture).toEqual({index:1});
    expect(wood.pbrMetallicRoughness.metallicRoughnessTexture).toEqual({index:2});
  });
  it('deduplicates loads, normalizes dimensions, and keeps instance resources independently disposable',async()=>{
    const original=asset();load.mockResolvedValue(original);
    const first=prepareArmchairModel(),second=prepareArmchairModel();expect(first).toBe(second);
    expect(await first).toBe(true);expect(load).toHaveBeenCalledTimes(1);
    const a=new Group(),b=new Group();expect(buildModelArmchair(a,furniture)).toBe(true);buildModelArmchair(b,furniture);
    const box=new Box3().setFromObject(a),size=box.getSize(new Vector3());
    expect(size.x).toBeCloseTo(.82);expect(size.y).toBeCloseTo(1);expect(size.z).toBeCloseTo(.98);expect(box.min.y).toBeCloseTo(0);
    const ma=a.children[0] as Mesh<BoxGeometry,MeshStandardMaterial>,mb=b.children[0] as Mesh<BoxGeometry,MeshStandardMaterial>;
    expect(ma.geometry===mb.geometry).toBe(false);expect(ma.material===mb.material).toBe(false);
    expect(ma.material.map===mb.material.map).toBe(false);expect(ma.material.map!.source===mb.material.map!.source).toBe(true);
    expect((a.children[1] as Mesh).geometry.getAttribute('uv1')).toBeDefined();
    expect(a.userData.assetModel).toBe('modern-arm-chair-01');
  });
  it('disposes a load that completes after leaving the view',async()=>{
    const original=asset(),dispose=vi.spyOn((original.scene.children[0] as Mesh).geometry,'dispose');
    let resolve!:(value:typeof original)=>void;load.mockImplementation(()=>new Promise(r=>{resolve=r;}));
    const pending=prepareArmchairModel();await vi.waitFor(()=>expect(load).toHaveBeenCalledOnce());releaseArmchairModel();resolve(original);
    expect(await pending).toBe(false);expect(dispose).toHaveBeenCalledOnce();
    expect(buildModelArmchair(new Group(),furniture)).toBe(false);
  });
  it('falls back on failure and permits a later retry',async()=>{
    load.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(asset());
    expect(await prepareArmchairModel()).toBe(false);expect(buildModelArmchair(new Group(),furniture)).toBe(false);
    expect(await prepareArmchairModel()).toBe(true);
  });
  it('bounds waiting and disposes a response that arrives after timeout',async()=>{
    vi.useFakeTimers();const original=asset(),dispose=vi.spyOn((original.scene.children[0] as Mesh).geometry,'dispose');
    let resolve!:(value:typeof original)=>void;load.mockImplementation(()=>new Promise(r=>{resolve=r;}));
    const pending=prepareArmchairModel();await vi.waitFor(()=>expect(load).toHaveBeenCalledOnce());await vi.advanceTimersByTimeAsync(6000);expect(await pending).toBe(false);
    resolve(original);await vi.advanceTimersByTimeAsync(0);expect(dispose).toHaveBeenCalledOnce();
    expect(buildModelArmchair(new Group(),furniture)).toBe(false);
  });
});
