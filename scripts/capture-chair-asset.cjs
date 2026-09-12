const { chromium, expect } = require('@playwright/test');
// Isolated viewer: checks the actual downloaded glTF, not its marketing preview.
(async()=>{
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage({viewport:{width:1000,height:900}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');
    const linen=process.env.ROOMSIM_CHAIR_LINEN==='1';
    const report=await page.evaluate(async(linen)=>{
      const T=await import('/node_modules/three/build/three.module.js');
      const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
      const {RoomEnvironment}=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
      const asset=await new GLTFLoader().loadAsync('/models/modern-arm-chair-01/modern_arm_chair_01_1k.gltf');
      if(linen){
        const loader=new T.TextureLoader();
        const [color,rough]=await Promise.all(['Color','Roughness'].map(channel=>loader.loadAsync(`/materials/fabric-032/Fabric032_1K-JPG_${channel}.jpg`)));
        color.colorSpace=T.SRGBColorSpace;
        for(const texture of [color,rough]){texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(2.5,2.5);texture.channel=1;}
        asset.scene.traverse(object=>{
          if(!object.isMesh||!object.material.name.includes('pillow'))return;
          const geometry=object.geometry,p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),coords=[];
          for(let i=0;i<p.count;i++)coords.push(p.getX(i),Math.abs(n.getY(i))>.65?p.getZ(i):p.getY(i));
          geometry.setAttribute('uv1',new T.Float32BufferAttribute(coords,2));
          const old=object.material;
          object.material=new T.MeshPhysicalMaterial({color:'#d9cfbc',map:color,roughnessMap:rough,roughness:1,
            normalMap:old.normalMap,normalScale:new T.Vector2(.65,.65),metalness:0,sheen:.35,sheenColor:new T.Color('#d9cfbc'),sheenRoughness:.9});
        });
      }
      document.body.replaceChildren();document.body.style.margin='0';
      const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1000,900);
      renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
      document.body.appendChild(renderer.domElement);
      const scene=new T.Scene();scene.background=new T.Color('#e7ded0');
      const environment=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer),env=pmrem.fromScene(environment);
      scene.environment=env.texture;environment.dispose();pmrem.dispose();
      const bounds=new T.Box3().setFromObject(asset.scene),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
      asset.scene.position.set(-center.x,-bounds.min.y,-center.z);scene.add(asset.scene);
      let meshes=0,triangles=0;
      asset.scene.traverse(object=>{if(object.isMesh){meshes++;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;object.castShadow=object.receiveShadow=true;}});
      const sun=new T.DirectionalLight('#fff2dc',1.8);sun.position.set(-2,4,3);sun.castShadow=true;
      sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-2;sun.shadow.camera.right=2;sun.shadow.camera.top=2;sun.shadow.camera.bottom=-2;sun.shadow.normalBias=.003;
      scene.add(sun,new T.HemisphereLight('#eee9df','#aa9987',.55));
      const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#d8cebf',roughness:.8}));floor.rotation.x=-Math.PI/2;floor.position.y=-.002;floor.receiveShadow=true;scene.add(floor);
      const camera=new T.PerspectiveCamera(35,1000/900,.01,100);camera.position.set(1.6,1.5,2.1);camera.lookAt(0,size.y*.45,0);
      renderer.render(scene,camera);
      return {meshes,triangles,size:size.toArray(),calls:renderer.info.render.calls,textures:renderer.info.memory.textures};
    },linen);
    await page.screenshot({path:linen?'docs/images/modern-arm-chair-linen-study.png':'docs/images/modern-arm-chair-asset-study.png'});
    expect(report.meshes).toBe(2);expect(report.triangles).toBeLessThan(10000);expect(errors).toEqual([]);
    console.log(report);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
