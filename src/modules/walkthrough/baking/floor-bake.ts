import type { Object3D } from 'three';
import { OcclusionBakeJob } from './bake-job';
import { snapshotOccluders } from './scene-snapshot';
import { attachFloorOcclusion, floorOcclusionTexture, type FloorBakeBounds } from './floor-occlusion';
import { prepareWallAtlas } from './wall-atlas';
import {raisedFloorReceivers} from './raised-floor-receivers';

/** Owns the whole snapshot -> worker -> floor texture lifetime, not scene objects. */
export class FloorBake {
  private abort:AbortController|null=null;
  private release:(()=>void)|null=null;
  private disposed=false;
  constructor(private job:Pick<OcclusionBakeJob,'start'|'cancel'|'dispose'>=new OcclusionBakeJob(),
    private snapshot:typeof snapshotOccluders=snapshotOccluders){}

  invalidate():void {
    this.abort?.abort();this.abort=null;this.job.cancel();
    this.release?.();this.release=null;
  }
  dispose():void {this.disposed=true;this.invalidate();this.job.dispose();}

  async start(occluders:Object3D[],floor:Object3D,bounds:FloorBakeBounds,walls?:Object3D):Promise<boolean> {
    this.invalidate();
    if(this.disposed)throw new Error('Floor bake is disposed');
    if(![bounds.minX,bounds.minZ,bounds.width,bounds.depth].every(Number.isFinite)||bounds.width<=0||bounds.depth<=0)
      throw new Error('Invalid floor bake bounds');
    // Copy caller data: edits must invalidate, never mutate an in-flight mapping.
    bounds={...bounds};
    const abort=new AbortController();this.abort=abort;
    const live=()=>!abort.signal.aborted&&!this.disposed;
    try{
      const parts:Float32Array[]=[];let length=0;
      for(const root of occluders){
        const part=await this.snapshot(root,{signal:abort.signal,maxTriangles:1_000_000-length/9});
        if(!part||!live())return false;
        parts.push(part);length+=part.length;
      }
      const triangles=new Float32Array(length);let offset=0,deadline=performance.now()+3;
      for(const part of parts){
        // Bound concatenation work even for a single large root.
        for(let i=0;i<part.length;i+=36864){
          triangles.set(part.subarray(i,i+36864),offset+i);
          if(performance.now()>=deadline){
            await new Promise<void>(resolve=>setTimeout(resolve,0));deadline=performance.now()+3;
          }
          if(!live())return false;
        }
        offset+=part.length;
      }
      const width=Math.max(1,Math.min(256,Math.ceil(bounds.width/.04)));
      const height=Math.max(1,Math.min(256,Math.ceil(bounds.depth/.04)));
      const positions=new Float32Array(width*height*3),normals=new Float32Array(positions.length);
      const raised=raisedFloorReceivers(occluders);
      let receiverDeadline=performance.now()+3;
      for(let z=0;z<height;z++){
        for(let x=0;x<width;x++){
          const i=(z*width+x)*3;
          positions[i]=bounds.minX+(x+.5)/width*bounds.width;
          positions[i+2]=bounds.minZ+(z+.5)/height*bounds.depth;normals[i+1]=1;
          for(const receiver of raised)if(receiver.height>positions[i+1]&&receiver.contains(positions[i],positions[i+2]))positions[i+1]=receiver.height;
        }
        if(performance.now()>=receiverDeadline){await new Promise<void>(resolve=>setTimeout(resolve,0));receiverDeadline=performance.now()+3;}
        if(!live())return false;
      }
      const result=await this.job.start({triangles,positions,normals,samples:32,radius:.6});
      if(!result||!live())return false;
      // Finish both jobs before publishing either texture, so cancel/error cannot
      // leave a partially applied room. Floor triangles also occlude wall bases.
      let wallBinding:ReturnType<ReturnType<typeof prepareWallAtlas>['apply']>|null=null;
      if(walls){
        const atlas=prepareWallAtlas(walls);
        if(atlas.chartCount){
          const floorTriangles=await this.snapshot(floor,{signal:abort.signal,maxTriangles:1_000_000-length/9});
          if(!floorTriangles||!live())return false;
          const all=new Float32Array(triangles.length+floorTriangles.length);
          let copied=0,copyDeadline=performance.now()+3;
          for(const part of [triangles,floorTriangles]){
            for(let i=0;i<part.length;i+=36864){
              all.set(part.subarray(i,i+36864),copied+i);
              if(performance.now()>=copyDeadline){
                await new Promise<void>(resolve=>setTimeout(resolve,0));copyDeadline=performance.now()+3;
              }
              if(!live())return false;
            }
            copied+=part.length;
          }
          const wallResult=await this.job.start({triangles:all,positions:atlas.positions,normals:atlas.normals,samples:32,radius:.8});
          if(!wallResult||!live())return false;
          wallBinding=atlas.apply(wallResult.values);
        }
      }
      let texture:ReturnType<typeof floorOcclusionTexture>|null=null;
      const detach:Array<()=>void>=[];
      try{
        texture=floorOcclusionTexture(result.values,width,height);
        detach.push(attachFloorOcclusion(floor,texture,bounds,.7));
        for(const receiver of raised)detach.push(attachFloorOcclusion(receiver.mesh,texture,bounds,.7));
        const owned=texture;
        this.release=()=>{for(const release of detach)release();owned.dispose();wallBinding?.dispose();};
      }catch(error){for(const release of detach)release();texture?.dispose();wallBinding?.dispose();throw error;}
      return true;
    }finally{if(this.abort===abort)this.abort=null;}
  }
}
