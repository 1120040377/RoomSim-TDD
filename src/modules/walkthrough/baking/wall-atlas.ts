import { DataTexture, DataUtils, HalfFloatType, UnsignedByteType, Float32BufferAttribute, LinearFilter, Matrix3, Mesh, MeshStandardMaterial, RGBAFormat, Vector3,
  type Object3D } from 'three';

/** Axis-aligned slab faces in local space, including trimmed door/window jambs. */
export function prepareWallAtlas(root:Object3D,spacing=.1) {
  if(!Number.isFinite(spacing)||spacing<=0)throw new Error('Invalid wall atlas spacing');
  const atlasWidth=1024,padding=2;
  const charts:Array<{mesh:Mesh;ids:number[];axis:number;u:number;v:number;sign:number;plane:number;
    minU:number;minV:number;maxU:number;maxV:number;width:number;height:number;x:number;y:number;offset:number}>=[];
  root.updateWorldMatrix(true,true);
  root.traverse(object=>{
    if(!(object instanceof Mesh)||!object.userData.wallId||!(object.material instanceof MeshStandardMaterial))return;
    const p=object.geometry.getAttribute('position'),n=object.geometry.getAttribute('normal');
    if(!p||!n)return;
    const faces=new Map<number,number[]>();
    for(let i=0;i<p.count;i++){
      const normal=[n.getX(i),n.getY(i),n.getZ(i)],axis=normal.findIndex(value=>Math.abs(value)>.999);
      if(axis<0)throw new Error('Wall atlas requires planar slab normals');
      const key=axis*2+(normal[axis]>0?1:0);if(!faces.has(key))faces.set(key,[]);faces.get(key)!.push(i);
    }
    for(const [key,ids] of faces){
      const axis=Math.floor(key/2),u=(axis+1)%3,v=(axis+2)%3;
      const component=(id:number,a:number)=>a===0?p.getX(id):a===1?p.getY(id):p.getZ(id);
      const us=ids.map(i=>component(i,u)),vs=ids.map(i=>component(i,v));
      const minU=Math.min(...us),maxU=Math.max(...us),minV=Math.min(...vs),maxV=Math.max(...vs);
      charts.push({mesh:object,ids,axis,u,v,sign:key%2?1:-1,plane:component(ids[0],axis),minU,maxU,minV,maxV,
        width:Math.max(2,Math.min(128,Math.ceil((maxU-minU)/spacing)+1)),
        height:Math.max(2,Math.min(128,Math.ceil((maxV-minV)/spacing)+1)),x:0,y:0,offset:0});
    }
  });
  let x=0,y=0,rowHeight=0,count=0;
  for(const chart of charts){
    const w=chart.width+padding*2,h=chart.height+padding*2;
    if(x+w>atlasWidth){x=0;y+=rowHeight;rowHeight=0;}
    if(y+h>1024)throw new Error('Wall atlas exceeds 1024 square budget');
    chart.x=x+padding;chart.y=y+padding;chart.offset=count;
    count+=chart.width*chart.height;x+=w;rowHeight=Math.max(rowHeight,h);
  }
  const atlasHeight=Math.max(1,y+rowHeight),positions=new Float32Array(count*3),normals=new Float32Array(count*3);
  const point=new Vector3(),normal=new Vector3(),normalMatrix=new Matrix3();
  for(const chart of charts){
    normal.set(0,0,0).setComponent(chart.axis,chart.sign).applyMatrix3(normalMatrix.getNormalMatrix(chart.mesh.matrixWorld)).normalize();
    for(let iy=0;iy<chart.height;iy++)for(let ix=0;ix<chart.width;ix++){
      point.set(0,0,0).setComponent(chart.axis,chart.plane)
        .setComponent(chart.u,chart.minU+(chart.maxU-chart.minU)*ix/(chart.width-1))
        .setComponent(chart.v,chart.minV+(chart.maxV-chart.minV)*iy/(chart.height-1)).applyMatrix4(chart.mesh.matrixWorld);
      const offset=(chart.offset+iy*chart.width+ix)*3;point.toArray(positions,offset);normal.toArray(normals,offset);
    }
  }
  let bound=false;
  return {positions,normals,chartCount:charts.length,atlasWidth,atlasHeight,
    apply(values:Float32Array,mode:'occlusion'|'irradiance'='occlusion',visibility?:Float32Array){
      if(bound)throw new Error('Wall atlas is already applied');
      const channels=mode==='irradiance'?3:1;
      if(values.length!==count*channels||values.some(value=>!Number.isFinite(value)||value<0||value>65504))throw new Error('Invalid wall visibility');
      if(visibility&&(channels!==3||visibility.length!==count||visibility.some(value=>!Number.isFinite(value)||value<0||value>1)))throw new Error('Invalid combined wall visibility');
      const pixels=channels===3?new Uint16Array(atlasWidth*atlasHeight*4):new Uint8Array(atlasWidth*atlasHeight*4).fill(255);
      const aoPixels=visibility?new Uint8Array(atlasWidth*atlasHeight*4).fill(255):null;
      for(const chart of charts)for(let iy=-padding;iy<chart.height+padding;iy++)for(let ix=-padding;ix<chart.width+padding;ix++){
        const source=(chart.offset+Math.max(0,Math.min(chart.height-1,iy))*chart.width+Math.max(0,Math.min(chart.width-1,ix)))*channels;
        const offset=((chart.y+iy)*atlasWidth+chart.x+ix)*4;
        for(let channel=0;channel<3;channel++)pixels[offset+channel]=channels===3?DataUtils.toHalfFloat(values[source+channel]):Math.round(Math.min(1,values[source])*255);
        pixels[offset+3]=channels===3?DataUtils.toHalfFloat(1):255;
        if(aoPixels&&visibility){const byte=Math.round(visibility[source/channels]*255);aoPixels[offset]=aoPixels[offset+1]=aoPixels[offset+2]=byte;}
      }
      const texture=new DataTexture(pixels,atlasWidth,atlasHeight,RGBAFormat,channels===3?HalfFloatType:UnsignedByteType);
      texture.channel=1;texture.minFilter=texture.magFilter=LinearFilter;texture.needsUpdate=true;
      const aoTexture=aoPixels?new DataTexture(aoPixels,atlasWidth,atlasHeight,RGBAFormat):null;
      if(aoTexture){aoTexture.channel=1;aoTexture.minFilter=aoTexture.magFilter=LinearFilter;aoTexture.needsUpdate=true;}
      const old=new Map<Mesh,{material:Mesh['material'];uv:ReturnType<Mesh['geometry']['getAttribute']>}>();
      const clones=new Map<MeshStandardMaterial,MeshStandardMaterial>();
      for(const chart of charts){
        const mesh=chart.mesh,geometry=mesh.geometry;
        if(!old.has(mesh)){
          old.set(mesh,{material:mesh.material,uv:geometry.getAttribute('uv1')});
          const source=mesh.material as MeshStandardMaterial;
          if(!clones.has(source)){
            const copy=source.clone();
            // Material.clone deep-copies planes. Camera cutaway updates the
            // shared originals in place, so keep that live binding after bake.
            copy.clippingPlanes=source.clippingPlanes;
            if(channels===3){copy.lightMap=texture;copy.lightMapIntensity=1;}else{copy.aoMap=texture;copy.aoMapIntensity=.7;}
            if(aoTexture){
              copy.aoMap=aoTexture;copy.aoMapIntensity=.7;
              // LightMap already traces visibility; AO must not attenuate it twice.
              copy.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
                #if defined(USE_LIGHTMAP) && defined(USE_AOMAP)
                reflectedLight.indirectDiffuse += lightMapIrradiance * BRDF_Lambert(material.diffuseColor) * (1.0 - ambientOcclusion);
                #endif`);};
              copy.customProgramCacheKey=()=> 'roomsim-visible-bounce-v1';
            }
            clones.set(source,copy);
          }
          mesh.material=clones.get(source)!;
          geometry.setAttribute('uv1',new Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count*2),2));
        }
        const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv1');
        for(const id of chart.ids){
          point.fromBufferAttribute(p,id);
          const u=(point.getComponent(chart.u)-chart.minU)/(chart.maxU-chart.minU||1);
          const v=(point.getComponent(chart.v)-chart.minV)/(chart.maxV-chart.minV||1);
          uv.setXY(id,(chart.x+.5+u*(chart.width-1))/atlasWidth,(chart.y+.5+v*(chart.height-1))/atlasHeight);
        }
      }
      bound=true;let released=false;
      return {texture,aoTexture,dispose(){
        if(released)return;released=true;bound=false;
        // Camera-only changes may replace the clip-plane array while this
        // overlay is active. Removing AO must not revert the current cutaway.
        for(const [source,copy] of clones){
          source.clippingPlanes=copy.clippingPlanes;
          source.clipIntersection=copy.clipIntersection;
          source.clipShadows=copy.clipShadows;
          source.needsUpdate=true;
        }
        for(const [mesh,previous] of old){mesh.material=previous.material;if(previous.uv)mesh.geometry.setAttribute('uv1',previous.uv);else mesh.geometry.deleteAttribute('uv1');}
        for(const material of clones.values())material.dispose();texture.dispose();aoTexture?.dispose();
      }};
    }};
}
