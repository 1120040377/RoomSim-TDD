import { describe,it,expect } from 'vitest';
import { BoxGeometry,Group,Mesh,MeshBasicMaterial,PerspectiveCamera,Vector3,Box3,EdgesGeometry,LineSegments,LineBasicMaterial } from 'three';
import { AIM_SCREEN_Y,pickAimedObject } from '@/modules/walkthrough/aim';
import { buildStylizedAvatar } from '@/modules/walkthrough/builders/stylized-avatar';

describe('准星交互与人物模型',()=>{
  it('上移的准星与拾取射线使用相同坐标，不再沿旧屏幕中心拾取',()=>{
    const camera=new PerspectiveCamera(70,1,0.01,100);camera.position.set(0,1,3);camera.lookAt(0,1,0);
    const height=1+3*Math.tan(35*Math.PI/180)*(1-2*AIM_SCREEN_Y);
    const object=new Mesh(new BoxGeometry(0.08,0.08,0.08),new MeshBasicMaterial());object.position.set(0,height,0);object.userData.furnitureId='switch';
    expect(pickAimedObject(camera,[object],new Vector3(0,1,1))).toBe('switch');
    object.position.y=1;expect(pickAimedObject(camera,[object],new Vector3(0,1,1))).toBeNull();
  });
  it('只有准星第一命中的近距离物体可用，透明遮挡墙仍阻挡交互',()=>{
    const camera=new PerspectiveCamera(70,1,0.01,100);camera.position.set(0,1,3);camera.lookAt(0,1,0);
    const furniture=new Group();furniture.userData.furnitureId='fridge';
    const mesh=new Mesh(new BoxGeometry(0.6,2,0.6),new MeshBasicMaterial());mesh.position.y=1;furniture.add(mesh);
    const eye=new Vector3(0,1,1);
    expect(pickAimedObject(camera,[furniture],eye)).toBe('fridge');
    expect(pickAimedObject(camera,[furniture],new Vector3(0,1,5))).toBeNull();
    const wall=new Mesh(new BoxGeometry(2,2,0.1),new MeshBasicMaterial({transparent:true,opacity:0.12}));wall.position.set(0,1,0.7);
    expect(pickAimedObject(camera,[furniture,wall],eye)).toBeNull();
    camera.lookAt(4,1,0);expect(pickAimedObject(camera,[furniture],eye)).toBeNull();
  });
  it('轮廓线的宽拾取范围不能代替实体表面命中',()=>{
    const camera=new PerspectiveCamera(70,1,0.01,100);camera.position.set(0,1,3);camera.lookAt(0,1,0);
    const g=new Group();g.userData.furnitureId='cabinet';g.position.set(0.7,1,0);
    const geometry=new BoxGeometry(0.4,1,0.4);
    g.add(new Mesh(geometry,new MeshBasicMaterial()),new LineSegments(new EdgesGeometry(geometry),new LineBasicMaterial()));
    expect(pickAimedObject(camera,[g],new Vector3(0,1,1))).toBeNull();
  });
  it('大人小孩有独立比例，切换保留根节点并支持动作',()=>{
    const avatar=buildStylizedAvatar();const root=avatar.group,adultHip=avatar.hipHeight;
    expect(new Box3().setFromObject(root).max.y).toBeGreaterThan(1.65);
    avatar.setKind('child');expect(avatar.group).toBe(root);expect(root.userData.avatarKind).toBe('child');
    expect(avatar.hipHeight).toBeLessThan(adultHip);
    avatar.pose('sit');avatar.pose('lie');expect(root.rotation.x).toBe(-Math.PI/2);
    avatar.pose('stand');avatar.animate(0.5,true);expect(root.rotation.x).toBe(0);
  });
});
