import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { removeInternalWallFaces } from '@/modules/walkthrough/builders/remove-internal-wall-faces';

function wall(x:number,height=2.8) {
  const mesh=new Mesh(new BoxGeometry(2,height,.12),new MeshStandardMaterial());
  mesh.position.set(x,height/2,0);return mesh;
}
describe('internal wall faces',()=>{
  it('removes both buried end caps, preserving exterior size and exposed ends',()=>{
    const a=wall(1),b=wall(3);
    expect(removeInternalWallFaces([a,b])).toBe(4);
    expect(a.geometry.index!.count+b.geometry.index!.count).toBe(60);
    const ray=new Raycaster(new Vector3(1,1,0),new Vector3(1,0,0));
    // Front-sided internal end faces used to be hit from within the adjacent slab.
    expect(ray.intersectObjects([a,b])).toHaveLength(0);
    ray.set(new Vector3(5,1,0),new Vector3(-1,0,0));
    expect(ray.intersectObjects([a,b])[0].point.x).toBeCloseTo(4);
  });
  it('retains partially exposed jambs and does not bridge actual gaps',()=>{
    const a=wall(1),b=wall(3,1);
    expect(removeInternalWallFaces([a,b])).toBe(2);
    expect(a.geometry.index!.count).toBe(36);
    const low=new Raycaster(new Vector3(3,.5,0),new Vector3(-1,0,0));
    expect(low.intersectObject(a)).toHaveLength(0);
    const high=new Raycaster(new Vector3(3,2,0),new Vector3(-1,0,0));
    expect(high.intersectObject(a)[0].point.x).toBeCloseTo(2);
    const c=wall(1),d=wall(3.01);
    expect(removeInternalWallFaces([c,d])).toBe(0);
  });
  it('retains caps between walls with different cutaway policies',()=>{
    const a=wall(1),b=wall(3);
    b.material.userData.interiorPartition=true;
    expect(removeInternalWallFaces([a,b])).toBe(0);
  });
  it('preserves UV scale and geometry parameters after trimming a rotated wall',()=>{
    const a=wall(1),b=wall(3,1);
    const angle=.6;
    for(const mesh of [a,b]){
      mesh.position.applyAxisAngle(new Vector3(0,1,0),angle);
      mesh.rotation.y=angle;
    }
    const geometry=a.geometry;
    removeInternalWallFaces([a,b]);
    expect(a.geometry).toBe(geometry);
    expect(geometry.parameters.width).toBe(2);
    const normal=geometry.getAttribute('normal'),position=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
    const edge=[];
    for(let i=0;i<position.count;i++)if(normal.getX(i)>.9){
      expect(position.getY(i)).toBeGreaterThanOrEqual(-.40001);
      edge.push(uv.getY(i));
    }
    expect(Math.min(...edge)).toBeCloseTo(1/2.8);
    expect(Math.max(...edge)).toBeCloseTo(1);
  });
});
