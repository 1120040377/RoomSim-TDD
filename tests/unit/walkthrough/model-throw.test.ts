import {afterEach,describe,it,expect,vi} from 'vitest';
import {BoxGeometry,Group,Mesh,MeshStandardMaterial} from 'three';
import {buildDrapedThrow,installDrapedThrow,releaseDrapedThrow} from '../../../src/modules/walkthrough/builders/furniture/model-throw';
afterEach(()=>releaseDrapedThrow());
describe('registered static throw',()=>{
  it('falls back unless a source and matching collision dimensions are available',()=>{
    expect(buildDrapedThrow(new Group(),1.5,.45,.9,'#879a7a')).toBe(false);
    installDrapedThrow(new Mesh(new BoxGeometry(),new MeshStandardMaterial()));
    expect(buildDrapedThrow(new Group(),1.8,.45,.9,'#879a7a')).toBe(false);
    expect(buildDrapedThrow(new Group(),1.5,.6,.9,'#879a7a')).toBe(false);
    expect(buildDrapedThrow(new Group(),1.5,.45,1.1,'#879a7a')).toBe(false);
  });
  it('owns a source copy and independent instance geometry',()=>{
    const source=new Mesh(new BoxGeometry(),new MeshStandardMaterial()),dispose=vi.spyOn(source.geometry,'dispose');
    installDrapedThrow(source);const a=new Group(),b=new Group();
    expect(buildDrapedThrow(a,1.5,.45,.9,'#879a7a')).toBe(true);expect(buildDrapedThrow(b,1.5,.45,.9,'#879a7a')).toBe(true);
    const one=a.children[0] as Mesh,two=b.children[0] as Mesh;
    expect(one.geometry).not.toBe(two.geometry);expect(one.geometry).not.toBe(source.geometry);
    one.geometry.getAttribute('position').setX(0,100);
    expect(two.geometry.getAttribute('position').getX(0)).not.toBe(100);
    releaseDrapedThrow();expect(dispose).not.toHaveBeenCalled();expect(two.geometry.getAttribute('position').count).toBeGreaterThan(0);
  });
});
