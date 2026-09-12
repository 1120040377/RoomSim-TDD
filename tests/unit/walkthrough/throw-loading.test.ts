import {afterEach,describe,it,expect,vi} from 'vitest';
import {BoxGeometry,Group,Mesh,MeshStandardMaterial} from 'three';
const {parse}=vi.hoisted(()=>({parse:vi.fn()}));
vi.mock('three/addons/loaders/GLTFLoader.js',()=>({GLTFLoader:class{parseAsync=parse;}}));
import {prepareDrapedThrow,releaseDrapedThrow,buildDrapedThrow} from '../../../src/modules/walkthrough/builders/furniture/model-throw';
const response=()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
function decoded(){const scene=new Group();scene.add(new Mesh(new BoxGeometry(),new MeshStandardMaterial()));return {scene};}
afterEach(()=>{releaseDrapedThrow();vi.unstubAllGlobals();vi.useRealTimers();parse.mockReset();});
describe('throw asset loading',()=>{
  it('deduplicates requests and keeps an owned source after decoded geometry disposal',async()=>{
    const fetch=vi.fn(async()=>response());vi.stubGlobal('fetch',fetch);const asset=decoded(),dispose=vi.spyOn((asset.scene.children[0] as Mesh).geometry,'dispose');parse.mockResolvedValue(asset);
    const first=prepareDrapedThrow();expect(prepareDrapedThrow()).toBe(first);expect(await first).toBe(true);
    expect(await prepareDrapedThrow()).toBe(true);expect(fetch).toHaveBeenCalledTimes(1);expect(dispose).toHaveBeenCalledTimes(1);
    expect(buildDrapedThrow(new Group(),1.5,.45,.9,'#fff')).toBe(true);
  });
  it('allows retry after network failure',async()=>{
    const fetch=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(response());vi.stubGlobal('fetch',fetch);parse.mockImplementation(async()=>decoded());
    expect(await prepareDrapedThrow()).toBe(false);expect(await prepareDrapedThrow()).toBe(true);
  });
  it('aborts on exit and ignores a late response',async()=>{
    let finish!:(value:ReturnType<typeof response>)=>void;
    const fetch=vi.fn((_url,_options)=>new Promise(resolve=>{finish=resolve;}));vi.stubGlobal('fetch',fetch);
    const pending=prepareDrapedThrow();const signal=fetch.mock.calls[0][1].signal;
    releaseDrapedThrow();expect(await pending).toBe(false);expect(signal.aborted).toBe(true);
    finish(response());await new Promise(resolve=>setTimeout(resolve,0));expect(parse).not.toHaveBeenCalled();
    expect(buildDrapedThrow(new Group(),1.5,.45,.9,'#fff')).toBe(false);
  });
  it('settles and aborts after six seconds rather than blocking entry forever',async()=>{
    vi.useFakeTimers();const fetch=vi.fn((_url,_options)=>new Promise(()=>{}));vi.stubGlobal('fetch',fetch);
    const pending=prepareDrapedThrow();await vi.advanceTimersByTimeAsync(6000);
    expect(await pending).toBe(false);expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });
});
