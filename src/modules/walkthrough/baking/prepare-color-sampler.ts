import {RGBAFormat,UnsignedByteType,type Texture} from 'three';
import {ReflectorColorSampler} from './color-sampler';

/** Readback stays off the UI thread. Each call owns one worker and bitmap copies. */
export async function prepareColorSampler(textures:Iterable<Texture>,signal?:AbortSignal){
  const pixels=new Map<object,{data:Uint8ClampedArray;width:number;height:number}>();
  let worker:Worker|null=null;
  try{
    for(const texture of textures){
      if(signal?.aborted)return null;
      if(pixels.has(texture.source)||texture.image?.data)continue;
      const image=texture.image;
      if(!image?.width||!image?.height)throw new Error('Reflector color texture is not loaded');
      worker??=new Worker(new URL('./texture-read.worker.ts',import.meta.url),{type:'module'});
      const activeWorker=worker;
      const result=await new Promise<{data:Uint8ClampedArray;width:number;height:number}|null>((resolve,reject)=>{
        let done=false;
        const finish=(value:{data:Uint8ClampedArray;width:number;height:number}|null,error?:Error)=>{
          if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);
          activeWorker.onmessage=null;activeWorker.onerror=null;activeWorker.onmessageerror=null;
          if(error)reject(error);else resolve(value);
        };
        const cancel=()=>finish(null),timer=setTimeout(()=>finish(null,new Error('Texture read timed out')),30000);
        signal?.addEventListener('abort',cancel,{once:true});
        activeWorker.onerror=event=>finish(null,new Error(event.message));
        activeWorker.onmessageerror=()=>finish(null,new Error('Texture read message failed'));
        activeWorker.onmessage=event=>{
          const data=event.data;
          if(data?.error){finish(null,new Error(data.error));return;}
          if(!(data?.data instanceof Uint8ClampedArray)||!Number.isInteger(data.width)||!Number.isInteger(data.height)||
            data.width<1||data.height<1||data.width>128||data.height>128||data.data.length!==data.width*data.height*4){
            finish(null,new Error('Invalid texture read result'));return;
          }
          finish(data);
        };
        // Copy, never transfer the image bitmap owned by a scene texture.
        Promise.resolve().then(()=>createImageBitmap(image)).then(bitmap=>{
          if(done){bitmap.close();return;}
          try{activeWorker.postMessage(bitmap,[bitmap]);}
          catch(error){bitmap.close();finish(null,error instanceof Error?error:new Error(String(error)));}
        },error=>finish(null,error instanceof Error?error:new Error(String(error))));
      });
      if(!result||signal?.aborted)return null;
      pixels.set(texture.source,result);
    }
    return new ReflectorColorSampler(texture=>{
      if(texture.image?.data){
        if(texture.type!==UnsignedByteType||texture.format!==RGBAFormat)throw new Error('Unsupported reflector data texture');
        return texture.image;
      }
      const result=pixels.get(texture.source);if(!result)throw new Error('Reflector image was not prepared');return result;
    });
  }finally{worker?.terminate();}
}
