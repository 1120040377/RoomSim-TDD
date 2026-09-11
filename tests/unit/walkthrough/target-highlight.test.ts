import { describe,it,expect } from 'vitest';
import { BoxGeometry,Group,Mesh,MeshStandardMaterial } from 'three';
import { TargetHighlight } from '@/modules/walkthrough/target-highlight';
describe('交互目标高亮',()=>{
  it('切换或清空恢复原材质；同一目标反复刷新不叠加亮度',()=>{
    const material=new MeshStandardMaterial({emissive:'#233456',emissiveIntensity:0.8});
    const color=material.emissive.clone(),g=new Group();g.add(new Mesh(new BoxGeometry(),material));
    const highlight=new TargetHighlight();highlight.set(g);const highlighted=material.emissive.clone();
    expect(highlighted.equals(color)).toBe(false);highlight.set(g);expect(material.emissive.equals(highlighted)).toBe(true);
    highlight.set(null);expect(material.emissive.equals(color)).toBe(true);expect(material.emissiveIntensity).toBe(0.8);
  });
});
