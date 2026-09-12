import { expect,it } from 'vitest';
import { Box3,DoubleSide,Mesh,MeshPhysicalMaterial,Raycaster,Vector3 } from 'three';
import { createEmptyPlan } from '@/modules/model/defaults';
import { buildOpenings } from '@/modules/walkthrough/builders/opening-builder';

it.each([20,80,120])('single-bay %s cm glazing retains positive sections and three draws',width=>{
  const p=createEmptyPlan('small-window');
  p.nodes.a={id:'a',position:{x:0,y:0}};p.nodes.b={id:'b',position:{x:400,y:0}};
  p.walls.w={id:'w',startNodeId:'a',endNodeId:'b',thickness:12,height:280};
  p.openings.v={id:'v',kind:'window',wallId:'w',offset:200,width,height:30,sillHeight:90};
  const group=buildOpenings(p).group.children[0];
  expect(group.children).toHaveLength(3);
  let triangles=0;
  group.traverse(object=>{
    if(!(object instanceof Mesh))return;
    const geometry=object.geometry,position=geometry.getAttribute('position');
    triangles+=(geometry.index?.count??position.count)/3;
    for(const value of position.array)expect(Number.isFinite(value)).toBe(true);
    geometry.computeBoundingBox();const size=geometry.boundingBox!.getSize(new Vector3());
    expect(size.x).toBeGreaterThan(0);expect(size.y).toBeGreaterThan(0);
  });
  expect(triangles).toBe(1070);
});

it('窗框/窗台与单层双面玻璃，沿墙定位且保留低成本透明路径',()=>{
  const p=createEmptyPlan('window');
  p.nodes.a={id:'a',position:{x:0,y:0}};p.nodes.b={id:'b',position:{x:400,y:0}};
  p.walls.w={id:'w',startNodeId:'a',endNodeId:'b',thickness:12,height:280};
  p.openings.v={id:'v',kind:'window',wallId:'w',offset:200,width:170,height:130,sillHeight:90};
  const g=buildOpenings(p).group.children[0],bounds=new Box3().setFromObject(g);
  expect(bounds.min.x).toBeCloseTo(1.15);expect(bounds.max.x).toBeCloseTo(2.85);
  expect(bounds.min.y).toBeCloseTo(0.9);expect(bounds.max.y).toBeCloseTo(2.2);
  expect(g.children).toHaveLength(3);
  const triangles=g.children.reduce((sum,o)=>{const geometry=(o as Mesh).geometry;
    return sum+(geometry.index?.count??geometry.getAttribute('position').count)/3;
  },0);
  expect(triangles).toBe(1274);
  const glass=g.getObjectByName('window-glass') as Mesh;
  const material=glass.material as MeshPhysicalMaterial;
  expect(material.transmission).toBe(0);expect(material.depthWrite).toBe(false);
  expect(material.side).toBe(DoubleSide);expect(material.opacity).toBe(0.16);
  expect(material.forceSinglePass).toBe(true);
  expect(glass.geometry.index!.count/3).toBe(2);expect(glass.castShadow).toBe(false);
  // Beads sit 9 mm behind the outer frame face, on both wall orientations.
  for(const side of [-1,1]){
    const ray=new Raycaster(new Vector3(1.15+.045+.005,1.7,side),new Vector3(0,0,-side));
    const bead=ray.intersectObject(g,true)[0];
    expect(bead.object).not.toBe(glass);expect(bead.point.z*side).toBeCloseTo(.0235,5);
    ray.ray.origin.x+=.03;
    expect(ray.intersectObject(g,true)[0].object).toBe(glass);
  }
});
