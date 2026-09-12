export type RenderResolution='balanced'|'native';
export const BALANCED_PIXEL_BUDGET=2_400_000;

/** Budget the drawing buffer, not CSS/UI size or model/texture detail. */
export function renderPixelRatio(width:number,height:number,dpr:number,mode:RenderResolution):number {
  const native=Number.isFinite(dpr)&&dpr>0?Math.min(dpr,2):1;
  if(mode==='native'||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return native;
  return Math.min(native,Math.sqrt(BALANCED_PIXEL_BUDGET/(width*height)));
}
