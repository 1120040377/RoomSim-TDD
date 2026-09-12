import {Color,MirroredRepeatWrapping,RepeatWrapping,RGBAFormat,SRGBColorSpace,Texture,UnsignedByteType,Vector2} from 'three';

type Pixels={data:Uint8Array|Uint8ClampedArray;width:number;height:number};
function readPixels(texture:Texture):Pixels {
  const image=texture.image;
  if(!image?.width||!image?.height)throw new Error('Reflector color texture is not loaded');
  if(image.data){
    if(texture.type!==UnsignedByteType||texture.format!==RGBAFormat)throw new Error('Unsupported reflector data texture');
    return image;
  }
  // Coarse color integration only; never download or rewrite source assets.
  const canvas=document.createElement('canvas');
  canvas.width=Math.min(128,image.width);canvas.height=Math.min(128,image.height);
  const context=canvas.getContext('2d',{willReadFrequently:true});
  if(!context)throw new Error('Reflector texture pixels unavailable');
  context.drawImage(image,0,0,canvas.width,canvas.height);
  return {data:context.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height};
}
const linear=(v:number)=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);
function wrapped(index:number,size:number,mode:number){
  if(mode===RepeatWrapping)return ((index%size)+size)%size;
  if(mode===MirroredRepeatWrapping){const p=((index%(2*size))+2*size)%(2*size);return p<size?p:2*size-1-p;}
  return Math.max(0,Math.min(size-1,index));
}

/** Snapshot-local cache; shared image sources decoded once per color space. */
export class ReflectorColorSampler {
  private sources=new Map<object,Map<string,{pixels:Float32Array;width:number;height:number}>>();
  private samplers=new Map<Texture,(uv:Vector2,target:Color)=>Color>();
  constructor(private read:(texture:Texture)=>Pixels=readPixels){}
  forTexture(texture:Texture){
    const cached=this.samplers.get(texture);if(cached)return cached;
    let spaces=this.sources.get(texture.source);if(!spaces){spaces=new Map();this.sources.set(texture.source,spaces);}
    let decoded=spaces.get(texture.colorSpace);
    if(!decoded){
      const {data,width,height}=this.read(texture),pixels=new Float32Array(width*height*3);
      for(let i=0;i<width*height;i++)for(let c=0;c<3;c++){
        const value=data[i*4+c]/255;pixels[i*3+c]=texture.colorSpace===SRGBColorSpace?linear(value):value;
      }
      decoded={pixels,width,height};spaces.set(texture.colorSpace,decoded);
    }
    if(texture.matrixAutoUpdate)texture.updateMatrix();
    const {pixels,width,height}=decoded,coordinate=new Vector2();
    const sample=(uv:Vector2,target:Color)=>{
      texture.transformUv(coordinate.copy(uv));
      const x=coordinate.x*width-.5,y=coordinate.y*height-.5,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
      target.setRGB(0,0,0);
      for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
        const offset=(wrapped(y0+dy,height,texture.wrapT)*width+wrapped(x0+dx,width,texture.wrapS))*3;
        const weight=(dx?fx:1-fx)*(dy?fy:1-fy);
        target.r+=pixels[offset]*weight;target.g+=pixels[offset+1]*weight;target.b+=pixels[offset+2]*weight;
      }
      return target;
    };
    this.samplers.set(texture,sample);return sample;
  }
}
