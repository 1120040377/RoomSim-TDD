import { GridHelper, Plane, Raycaster, Vector2, Vector3, Line, BufferGeometry, LineBasicMaterial, type Camera, type Group, type Scene, type Object3D } from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { nanoid } from 'nanoid';
import type { Plan, SelectionTarget, UtilityKind, UtilityPoint } from '@/modules/model/types';
import { useHistoryStore } from '@/modules/store/history';
import { UpdateFurnitureCommand } from '@/modules/commands/furniture/update';
import { putUtility } from '@/modules/commands/renovation';
import { UTILITY_CATALOG } from '@/modules/renovation/model';

export type SceneEditTool='select'|'mount'|'point'|'route';
export function route3D(start:UtilityPoint,end:UtilityPoint):UtilityPoint[] {
  const points=[start,{x:end.x,y:start.y,height:start.height},{x:end.x,y:end.y,height:start.height},end];
  return points.filter((p,i)=>!i||p.x!==points[i-1].x||p.y!==points[i-1].y||p.height!==points[i-1].height);
}
export class SceneEditor {
  readonly transform:TransformControls;
  readonly floorGrid:GridHelper;
  readonly wallGrid:GridHelper;
  tool:SceneEditTool='select';
  kind:UtilityKind='socket';
  step=5;
  private ray=new Raycaster();
  private selection:SelectionTarget|null=null;
  private active=false;
  private started=false;
  private dragOrigin=new Vector3();
  private pointerOrigin=new Vector2();
  private route:UtilityPoint[]=[];
  private cleanups:Array<()=>void>=[];
  private preview=new Line(new BufferGeometry(),new LineBasicMaterial({color:'#248fba',depthTest:false,transparent:true}));
  constructor(private camera:Camera,private scene:Scene,private element:HTMLElement,
    private getPlan:()=>Plan,private groups:()=>{furniture:Group;utilities:Group;walls:Group},
    private onSelect:(s:SelectionTarget|null)=>void,private onDrag:(dragging:boolean)=>void,private notice:(message:string)=>void) {
    this.transform=new TransformControls(camera,element);this.transform.setMode('translate');this.transform.setSize(0.75);scene.add(this.transform);
    this.floorGrid=new GridHelper(30,300,'#689aa0','#bccdd2');this.floorGrid.position.y=0.008;scene.add(this.floorGrid);
    for(const material of (Array.isArray(this.floorGrid.material)?this.floorGrid.material:[this.floorGrid.material])){material.transparent=true;material.opacity=0.22;material.depthWrite=false;}
    this.wallGrid=new GridHelper(4,80,'#257984','#88b9bf');scene.add(this.wallGrid);this.wallGrid.visible=false;
    this.preview.renderOrder=30;scene.add(this.preview);this.preview.visible=false;
    this.transform.addEventListener('mouseDown',()=>{this.started=true;this.dragOrigin.copy(this.transform.object!.position);this.onDrag(true);});
    this.transform.addEventListener('mouseUp',()=>{
      this.onDrag(false);this.commitTransform();setTimeout(()=>{this.started=false;},0);
    });
    const down=(e:PointerEvent)=>this.pointerOrigin.set(e.clientX,e.clientY);
    const up=(e:PointerEvent)=>{
      if(!this.active||this.started||e.button!==0||this.pointerOrigin.distanceTo(new Vector2(e.clientX,e.clientY))>4)return;
      this.click(e);
    };
    const move=(e:PointerEvent)=>{if(this.active&&this.tool!=='select'){
      const hit=this.surface(e);
      if(this.tool==='route'&&hit&&this.route.length){const p={x:Math.round(hit.point.x*100/this.step)*this.step,y:Math.round(hit.point.z*100/this.step)*this.step,height:Math.max(0,Math.round(hit.point.y*100/this.step)*this.step)};this.drawRoute([...this.route,...route3D(this.route.at(-1)!,p).slice(1)]);}
    }};
    const key=(e:KeyboardEvent)=>{
      if(!this.active||(e.target instanceof Element&&e.target.closest('input,select,textarea')))return;
      if(e.key==='Enter')this.finishRoute();
      if(e.key==='Escape'){this.route=[];this.preview.visible=false;this.notice('已取消未完成布线');}
    };
    element.addEventListener('pointerdown',down);element.addEventListener('pointerup',up);element.addEventListener('pointermove',move);window.addEventListener('keydown',key);
    this.cleanups.push(()=>{element.removeEventListener('pointerdown',down);element.removeEventListener('pointerup',up);element.removeEventListener('pointermove',move);window.removeEventListener('keydown',key);});
    this.setActive(false);
  }
  setActive(active:boolean) {this.active=active;this.floorGrid.visible=active;this.transform.enabled=active;if(!active){this.transform.detach();this.route=[];this.preview.visible=false;this.wallGrid.visible=false;}}
  setTool(tool:SceneEditTool,kind=this.kind) {this.tool=tool;this.kind=kind;this.route=[];this.preview.visible=false;this.wallGrid.visible=false;if(tool!=='select')this.transform.detach();else this.select(this.selection);}
  select(selection:SelectionTarget|null) {
    this.selection=selection;this.transform.detach();if(!selection||!this.active||this.tool!=='select')return;
    const groups=this.groups();const group=selection.kind==='furniture'?groups.furniture:selection.kind==='utility'?groups.utilities:null;
    const object=group?.children.find(o=>o.userData.furnitureId===selection.id||o.userData.utilityId===selection.id);
    if(object&&object.visible&&group?.visible){this.transform.setTranslationSnap(this.step/100);this.transform.attach(object);}
  }
  refresh(){this.select(this.selection);}
  setStep(step:number){this.step=step;this.transform.setTranslationSnap(step/100);}
  private setRay(e:PointerEvent){const r=this.element.getBoundingClientRect();this.ray.setFromCamera(new Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);this.scene.updateMatrixWorld(true);}
  private surface(e:PointerEvent) {
    this.setRay(e);
    const hit=this.ray.intersectObject(this.groups().walls,true)[0];
    if(hit&&hit.face) {
      const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      if(Math.abs(normal.y)>0.2)return null;
      const p=hit.point.clone().addScaledVector(normal,0.015);
      this.wallGrid.position.copy(p);this.wallGrid.quaternion.setFromUnitVectors(new Vector3(0,1,0),normal);this.wallGrid.visible=true;
      return {point:p,normal,wall:true};
    }
    const p=this.ray.ray.intersectPlane(new Plane(new Vector3(0,1,0),0),new Vector3());
    this.wallGrid.visible=false;return p?{point:p,normal:new Vector3(0,1,0),wall:false}:null;
  }
  private click(e:PointerEvent) {
    if(this.tool==='select') {
      this.setRay(e);const hit=this.ray.intersectObjects([this.groups().furniture,this.groups().utilities],true).find(hit=>{
        let object:Object3D|null=hit.object;while(object){if(!object.visible)return false;object=object.parent;}return true;
      });
      let object:Object3D|null=hit?.object??null;
      while(object&&!object.userData.furnitureId&&!object.userData.utilityId)object=object.parent;
      const selection:SelectionTarget|null=object?.userData.furnitureId?{kind:'furniture',id:object.userData.furnitureId}:object?.userData.utilityId?{kind:'utility',id:object.userData.utilityId}:null;
      this.select(selection);this.onSelect(selection);return;
    }
    const hit=this.surface(e);if(!hit)return;
    const snap=(n:number)=>Math.round(n*100/this.step)*this.step;
    const point:UtilityPoint={x:snap(hit.point.x),y:snap(hit.point.z),height:Math.max(0,snap(hit.point.y))};
    if(this.tool==='mount') {
      const f=this.selection?.kind==='furniture'?this.getPlan().furniture[this.selection.id]:null;
      if(!f){this.notice('先从清单选择要安装的家具');return;}
      if(!hit.wall){this.notice('请点击墙面，网格会显示安装平面');return;}
      const halfDepth=f.size.depth/2+2;
      const height=Math.min(500,Math.max(0,point.height!-f.size.height/2));
      useHistoryStore().execute(new UpdateFurnitureCommand(f.id,{position:{x:point.x+hit.normal.x*halfDepth,y:point.y+hit.normal.z*halfDepth},elevation:height,
        rotation:Math.atan2(hit.normal.x,-hit.normal.z),mount:'wall',wallAligned:true}));
      this.notice('已贴墙安装；可用属性数值继续微调');return;
    }
    if(this.tool==='point') {
      const def=UTILITY_CATALOG[this.kind];const id=nanoid();
      useHistoryStore().execute(putUtility({id,kind:this.kind,label:def.name,points:[point],height:point.height!,rotation:hit.wall?Math.atan2(hit.normal.x,-hit.normal.z):0,circuit:''}));
      this.onSelect({kind:'utility',id});this.notice(`已放置${def.name}，离地 ${point.height} cm`);return;
    }
    if(!this.route.length)this.route=[point];else this.route.push(...route3D(this.route.at(-1)!,point).slice(1));
    this.drawRoute(this.route);
    this.notice(`已记录 ${this.route.length} 个布线节点；Enter 完成，Esc 取消`);
  }
  finishRoute(){
    if(this.route.length<2){this.notice('至少点击两个位置再完成布线');return;}
    const id=nanoid();useHistoryStore().execute(putUtility({id,kind:this.kind,label:`${UTILITY_CATALOG[this.kind].name}管线`,points:[...this.route],height:this.route[0].height??0,rotation:0,circuit:''}));
    this.route=[];this.preview.visible=false;this.onSelect({kind:'utility',id});this.notice('已保存立体管线，可撤销');
  }
  private drawRoute(points:UtilityPoint[]){this.preview.geometry.dispose();this.preview.geometry=new BufferGeometry().setFromPoints(points.map(p=>new Vector3(p.x/100,(p.height??0)/100,p.y/100)));this.preview.material.color.set(UTILITY_CATALOG[this.kind].color);this.preview.visible=true;}
  private commitTransform(){
    const selected=this.selection,object=this.transform.object;if(!selected||!object)return;
    const plan=this.getPlan(),delta=object.position.clone().sub(this.dragOrigin).multiplyScalar(100);
    if(delta.length()<0.01)return;
    if(selected.kind==='furniture') {
      const f=plan.furniture[selected.id];if(!f)return;
      const elevation=Math.max(0,Math.min(500,(f.elevation??Number(object.userData.baseElevation??0))+delta.y));
      useHistoryStore().execute(new UpdateFurnitureCommand(f.id,{position:{x:f.position.x+delta.x,y:f.position.y+delta.z},elevation}));
    } else if(selected.kind==='utility') {
      const u=plan.renovation?.utilities[selected.id];if(!u)return;
      const min=Math.min(...u.points.map(p=>p.height??u.height)),max=Math.max(...u.points.map(p=>p.height??u.height));
      delta.y=Math.max(-min,Math.min(500-max,delta.y));
      useHistoryStore().execute(putUtility({...u,height:u.height+delta.y,points:u.points.map(p=>({x:p.x+delta.x,y:p.y+delta.z,height:(p.height??u.height)+delta.y}))}));
    }
  }
  dispose(){this.cleanups.forEach(fn=>fn());this.transform.detach();this.transform.dispose();this.scene.remove(this.transform,this.floorGrid,this.wallGrid,this.preview);this.preview.geometry.dispose();this.preview.material.dispose();for(const grid of [this.floorGrid,this.wallGrid]){grid.geometry.dispose();const ms=Array.isArray(grid.material)?grid.material:[grid.material];ms.forEach(m=>m.dispose());}}
}
