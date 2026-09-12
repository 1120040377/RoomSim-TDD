const scope=self as unknown as {onmessage:((event:MessageEvent<ImageBitmap>)=>void)|null;postMessage:(value:unknown,transfer?:Transferable[])=>void};
scope.onmessage=event=>{
  const bitmap=event.data;
  try{
    const width=Math.min(128,bitmap.width),height=Math.min(128,bitmap.height);
    const canvas=new OffscreenCanvas(width,height),context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)throw new Error('Background texture reader unavailable');
    context.drawImage(bitmap,0,0,width,height);
    const data=context.getImageData(0,0,width,height).data;
    scope.postMessage({data,width,height},[data.buffer]);
  }catch(error){scope.postMessage({error:error instanceof Error?error.message:String(error)});}
  finally{bitmap.close();}
};
