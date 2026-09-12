export interface GraphicsDiagnostics { renderer:string; unmasked:boolean; software:boolean; width:number; height:number; lost:boolean }

/** Read only on explicit inspection/resize, never in the animation loop. */
export function graphicsDiagnostics(gl:WebGLRenderingContext|WebGL2RenderingContext):GraphicsDiagnostics {
  const lost=gl.isContextLost();
  if(lost)return {renderer:'图形上下文已丢失',unmasked:false,software:false,width:0,height:0,lost};
  const debug=gl.getExtension('WEBGL_debug_renderer_info');
  const renderer=String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)||'浏览器未提供设备名称');
  return {renderer,unmasked:!!debug,software:/SwiftShader|llvmpipe|software rasterizer/i.test(renderer),
    width:gl.drawingBufferWidth,height:gl.drawingBufferHeight,lost};
}
