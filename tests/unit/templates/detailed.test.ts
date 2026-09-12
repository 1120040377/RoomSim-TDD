import { describe,it,expect } from 'vitest';
import { BUILT_IN_TEMPLATES } from '@/modules/templates';
import { PlanSchema } from '@/modules/model/schema';

describe('精装生活模板',()=>{
  it('住宅模板房间从入户连通，主卫仅连主卧，客餐厅通过无门扇开口相连',()=>{
    for(const tpl of BUILT_IN_TEMPLATES.filter(t=>['two-bed-two-living','three-bed-two-living'].includes(t.id))){
      const p=tpl.build(tpl.name),rooms=Object.values(p.rooms),seen=new Set<string>();
      const entry=rooms.find(r=>r.name==='入户玄关')!;expect(entry).toBeDefined();seen.add(entry.id);
      let changed=true;while(changed){changed=false;for(const op of Object.values(p.openings).filter(o=>o.kind==='door')){
        const linked=rooms.filter(r=>r.wallIds.includes(op.wallId));if(linked.some(r=>seen.has(r.id)))for(const r of linked)if(!seen.has(r.id)){seen.add(r.id);changed=true;}
      }}
      expect(seen.size).toBe(rooms.length);
      const living=rooms.find(r=>r.name==='客厅')!,dining=rooms.find(r=>r.name==='餐厅')!;
      expect(Object.values(p.openings).some(o=>o.kind==='door'&&o.passage&&living.wallIds.includes(o.wallId)&&dining.wallIds.includes(o.wallId))).toBe(true);
      const ensuite=rooms.find(r=>r.name==='主卫');if(ensuite){
        const connections=Object.values(p.openings).filter(o=>o.kind==='door'&&ensuite.wallIds.includes(o.wallId));
        expect(connections).toHaveLength(1);
        expect(rooms.find(r=>r.name==='主卧套房')!.wallIds).toContain(connections[0].wallId);
      }
      for(const room of rooms.filter(r=>['主卧','主卧套房','北次卧','南次卧','次卧','厨房','主卫','公卫'].includes(r.name))){
        expect(Object.values(p.openings).some(o=>o.kind==='window'&&room.wallIds.includes(o.wallId)),`${tpl.name} ${room.name} 缺少外窗`).toBe(true);
      }
    }
  });
  it('公开七种方案（含材质样板间），每个完整户型识别全部房间，开洞不超出墙段',()=>{
    expect(BUILT_IN_TEMPLATES.map(t=>t.id)).toEqual(['blank','material-showroom','studio','one-bed-one-living','two-bed-one-living','two-bed-two-living','three-bed-two-living']);
    const counts=[0,7,2,4,5,9,12];
    BUILT_IN_TEMPLATES.forEach((tpl,i)=>{
      const p=tpl.build(tpl.name);expect(PlanSchema.safeParse(p).success).toBe(true);expect(Object.keys(p.rooms).length,tpl.name).toBe(counts[i]);
      for(const o of Object.values(p.openings)){
        const w=p.walls[o.wallId],a=p.nodes[w.startNodeId].position,b=p.nodes[w.endNodeId].position,len=Math.hypot(b.x-a.x,b.y-a.y);
        expect(o.offset-o.width/2,`${tpl.name} opening start`).toBeGreaterThanOrEqual(0);
        expect(o.offset+o.width/2,`${tpl.name} opening end`).toBeLessThanOrEqual(len);
      }
      if(i){
        const kinds=new Set(Object.values(p.renovation!.utilities).map(u=>u.kind));
        for(const kind of ['socket','switch','cold-water','hot-water','drain','electric'])expect(kinds.has(kind as never),`${tpl.name}:${kind}`).toBe(true);
        expect(Object.values(p.furniture).some(f=>f.type==='fridge')).toBe(true);
        for(const room of Object.values(p.rooms))expect(Object.values(p.openings).some(o=>o.kind==='door'&&room.wallIds.includes(o.wallId)),`${tpl.name}:${room.name}没有门`).toBe(true);
      }
    });
  });
  it('落地家具不穿实体墙，允许门洞及壁挂设施',()=>{
    const errors:string[]=[];
    for(const tpl of BUILT_IN_TEMPLATES.slice(1)){
      const p=tpl.build(tpl.name);
      for(const f of Object.values(p.furniture)){
        if(f.elevation||f.type.startsWith('lamp')||f.type==='switch')continue;
        const c=Math.abs(Math.cos(f.rotation)),s=Math.abs(Math.sin(f.rotation));
        const hw=(c*f.size.width+s*f.size.depth)/2,hd=(s*f.size.width+c*f.size.depth)/2;
        for(const w of Object.values(p.walls)){
          const a=p.nodes[w.startNodeId].position,b=p.nodes[w.endNodeId].position;
          const minX=Math.min(a.x,b.x)-w.thickness/2,maxX=Math.max(a.x,b.x)+w.thickness/2,minY=Math.min(a.y,b.y)-w.thickness/2,maxY=Math.max(a.y,b.y)+w.thickness/2;
          const overlap=Math.min(f.position.x+hw,maxX)-Math.max(f.position.x-hw,minX)>1&&Math.min(f.position.y+hd,maxY)-Math.max(f.position.y-hd,minY)>1;
          if(overlap)errors.push(`${tpl.name}:${f.type}@${f.position.x},${f.position.y}`);
        }
      }
    }
    expect(errors).toEqual([]);
  });
});
