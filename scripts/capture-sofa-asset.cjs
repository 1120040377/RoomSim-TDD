const { chromium, expect } = require('@playwright/test');

// Candidate evaluation only; the room's L-shaped sofa is not replaced.
(async()=>{
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage({viewport:{width:1200,height:850}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.goto(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');
    const report=await page.evaluate(async()=>{
      const T=await import('/node_modules/three/build/three.module.js');
      const { GLTFLoader }=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
      const { RoomEnvironment }=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
      const asset=await new GLTFLoader().loadAsync('/docs/asset-studies/glam-velvet-sofa/GlamVelvetSofa.gltf');
      const champagne=await asset.parser.getDependency('material',2);
      let meshes=0,triangles=0;const lights=[];
      asset.scene.traverse(object=>{
        if(object.isLight)lights.push(object);
        if(!object.isMesh)return;
        meshes++;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;
        if(object.material.name.includes('fabric'))object.material=champagne;
        object.castShadow=object.receiveShadow=true;
      });
      // Do not smuggle the model's presentation light into the room renderer.
      lights.forEach(light=>light.removeFromParent());
      document.body.replaceChildren();document.body.style.margin='0';
      const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,850);
      renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
      document.body.appendChild(renderer.domElement);
      const scene=new T.Scene();scene.background=new T.Color('#e7ded0');
      const environment=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer),env=pmrem.fromScene(environment);
      scene.environment=env.texture;environment.dispose();pmrem.dispose();
      const bounds=new T.Box3().setFromObject(asset.scene),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
      asset.scene.position.set(-center.x,-bounds.min.y,-center.z);scene.add(asset.scene);
      const sun=new T.DirectionalLight('#fff2dc',1.8);sun.position.set(-2,4,3);sun.castShadow=true;
      sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-2,right:2,top:2,bottom:-2});sun.shadow.normalBias=.003;
      scene.add(sun,new T.HemisphereLight('#eee9df','#aa9987',.55));
      const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#d8cebf',roughness:.8}));
      floor.rotation.x=-Math.PI/2;floor.position.y=-.002;floor.receiveShadow=true;scene.add(floor);
      const camera=new T.PerspectiveCamera(35,1200/850,.01,100);
      camera.position.set(2.6,1.8,3.5);camera.lookAt(0,size.y*.45,0);renderer.render(scene,camera);
      return {meshes,triangles,size:size.toArray(),removedLights:lights.length,
        calls:renderer.info.render.calls,textures:renderer.info.memory.textures};
    });
    expect(report.meshes).toBe(3);expect(report.triangles).toBeLessThan(5000);expect(errors).toEqual([]);
    await page.screenshot({path:'docs/images/glam-velvet-sofa-asset-study.png'});
    console.log(report);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
