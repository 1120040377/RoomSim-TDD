import {expect,it,vi} from 'vitest';
import {graphicsDiagnostics} from '@/modules/walkthrough/graphics-diagnostics';

function context(name:string,expose=true,lost=false){
  return {isContextLost:()=>lost,getExtension:vi.fn(()=>expose?{UNMASKED_RENDERER_WEBGL:37446}:null),
    getParameter:vi.fn(()=>name),RENDERER:7937,drawingBufferWidth:1897,drawingBufferHeight:1264} as unknown as WebGL2RenderingContext;
}
it('reports the actual adapter and buffer without inferring an integrated or discrete GPU',()=>{
  const gl=context('ANGLE (AMD Radeon Graphics)');
  expect(graphicsDiagnostics(gl)).toEqual({renderer:'ANGLE (AMD Radeon Graphics)',unmasked:true,software:false,width:1897,height:1264,lost:false});
  expect(gl.getParameter).toHaveBeenCalledWith(37446);
});
it('handles privacy masking and recognized software adapters',()=>{
  const masked=context('WebKit WebGL',false);
  expect(graphicsDiagnostics(masked).unmasked).toBe(false);
  expect(masked.getParameter).toHaveBeenCalledWith(7937);
  expect(graphicsDiagnostics(context('ANGLE (SwiftShader Device)')).software).toBe(true);
});
it('does not query an unavailable context',()=>{
  const gl=context('',true,true);
  expect(graphicsDiagnostics(gl).lost).toBe(true);
  expect(gl.getExtension).not.toHaveBeenCalled();expect(gl.getParameter).not.toHaveBeenCalled();
});
