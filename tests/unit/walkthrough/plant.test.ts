import { describe, expect, it } from 'vitest';
import { Box3, Color, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { buildFloorPlant } from '@/modules/walkthrough/builders/furniture/plant';
import { FurnitureSchema } from '@/modules/model/schema';

describe('独立盆栽资产', () => {
  it('uses stable per-asset branching instead of identical crowns or random reloads', () => {
    const matrices = (id: string) => {
      const group = new Group();
      buildFloorPlant(group, { id, type:'floor-plant', position:{x:0,y:0}, rotation:0,
        size:{width:75,depth:75,height:145} });
      let result: number[] = [];
      group.traverse(object => {
        if (object instanceof InstancedMesh && object.count === 72) result=Array.from(object.instanceMatrix.array);
        if (object instanceof Mesh) {
          object.geometry.dispose();
          const materials=Array.isArray(object.material)?object.material:[object.material];
          materials.forEach(material=>material.dispose());
        }
      });
      return result;
    };
    expect(matrices('balcony-tree')).toEqual(matrices('balcony-tree'));
    expect(matrices('balcony-tree')).not.toEqual(matrices('living-tree'));
  });
  it('可保存且按指定尺寸缩放，72 片叶子使用一个实例化网格', () => {
    const furniture = { id: 'plant', type: 'floor-plant' as const, position: { x: 0, y: 0 }, rotation: 0,
      size: { width: 75, depth: 75, height: 145 } };
    expect(FurnitureSchema.safeParse(furniture).success).toBe(true);
    const group = new Group(); buildFloorPlant(group, furniture);
    const bounds = new Box3().setFromObject(group), size = bounds.getSize(new Vector3());
    expect(size.x).toBeCloseTo(0.75); expect(size.z).toBeCloseTo(0.75); expect(size.y).toBeCloseTo(1.45);
    expect(bounds.min.y).toBeCloseTo(0);
    const meshes: Mesh[] = []; group.traverse(o => { if (o instanceof Mesh) meshes.push(o); });
    expect(meshes).toHaveLength(4);
    const instances = meshes.filter((mesh): mesh is InstancedMesh => mesh instanceof InstancedMesh);
    expect(instances).toHaveLength(2);
    expect(instances.map(mesh => mesh.count)).toEqual([86, 72]);
    const leaves=instances[1],matrix=new Matrix4();
    for(let i=0;i<leaves.count;i++){
      leaves.getMatrixAt(i,matrix);
      expect(new Vector3(0,0,1).transformDirection(matrix).y).toBeGreaterThan(.7);
    }
    expect(leaves.geometry.index!.count/3).toBe(32);
    expect((leaves.material as MeshStandardMaterial).vertexColors).toBe(true);
    expect((leaves.material as MeshStandardMaterial).transparent).toBe(false);
    const colors=leaves.geometry.getAttribute('color');
    expect(colors.count).toBe(leaves.geometry.getAttribute('position').count);
    const shades=Array.from({length:colors.count},(_,i)=>colors.getY(i));
    expect(Math.min(...shades)).toBeLessThan(0.7);
    expect(Math.max(...shades)).toBeCloseTo(1);
    const mature=new Color(),young=new Color();
    leaves.getColorAt(0,mature);leaves.getColorAt(6,young);
    expect(young.g).toBeGreaterThan(mature.g);
    let triangles=0;
    for(const mesh of meshes)triangles+=(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3*(mesh instanceof InstancedMesh?mesh.count:1);
    expect(triangles).toBeLessThan(5500);
    expect(meshes.every(mesh => mesh.castShadow && mesh.receiveShadow)).toBe(true);
  });
});
