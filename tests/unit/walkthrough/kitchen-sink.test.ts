import { describe, expect, it } from 'vitest';
import { Group, Raycaster, Vector3 } from 'three';
import { buildSink } from '@/modules/walkthrough/builders/furniture/kitchen';

describe('厨房水槽开孔', () => {
  it('水槽中心能进入盆腔，而外侧台面保留实体', () => {
    const group = new Group();
    buildSink(group,{id:'sink',type:'sink',position:{x:0,y:0},rotation:0,size:{width:80,depth:60,height:85}},280);
    group.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(0.06,2,0),new Vector3(0,-1,0));
    const center = ray.intersectObject(group,true);
    expect(center.length).toBeGreaterThan(0);
    expect(center[0].point.y).toBeLessThan(0.75);
    ray.set(new Vector3(0.37,2,0),new Vector3(0,-1,0));
    expect(ray.intersectObject(group,true)[0].point.y).toBeCloseTo(0.85,3);
  });
});
