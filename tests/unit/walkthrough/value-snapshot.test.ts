import {expect,it} from 'vitest';
import {ValueSnapshot} from '@/modules/walkthrough/value-snapshot';

it('reuses buffers, detects changes and respects explicit invalidation',()=>{
  const snapshot=new ValueSnapshot(),first=snapshot.begin();first.push(1,true,'x');expect(snapshot.commit()).toBe(true);
  const second=snapshot.begin();second.push(1,true,'x');expect(snapshot.commit()).toBe(false);
  expect(snapshot.begin()).toBe(first);first.push(1,true,'y');expect(snapshot.commit()).toBe(true);
  snapshot.invalidate();snapshot.begin().push(1,true,'y');expect(snapshot.commit()).toBe(true);
});
it('does not confuse commas, primitive types or array length',()=>{
  const snapshot=new ValueSnapshot();
  for(const values of [['a,b','c'],['a','b,c'],[1],['1'],[null],[''],[]]){
    snapshot.begin().push(...values);expect(snapshot.commit()).toBe(true);
  }
});
it('keeps NaN stable but distinguishes signed zero',()=>{
  const snapshot=new ValueSnapshot();snapshot.begin().push(NaN,0);snapshot.commit();
  snapshot.begin().push(NaN,0);expect(snapshot.commit()).toBe(false);
  snapshot.begin().push(NaN,-0);expect(snapshot.commit()).toBe(true);
});
