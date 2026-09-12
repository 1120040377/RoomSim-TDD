const {chromium,expect}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');
    const bedStudy=process.env.ROOMSIM_CLOTH_BED==='1';
    const report=await page.evaluate(async(bedStudy)=>{
      const T=await import('/node_modules/.vite/deps/three.js');
      const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
      const {RoomEnvironment}=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
      const {fabricMaterial}=await import('/src/modules/walkthrough/builders/furniture/material-library.ts');
      const {RoundedBoxGeometry}=await import('/node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js');
      const asset=await new GLTFLoader().loadAsync('/docs/asset-studies/draped-throw/draped-throw.glb');
      let meshes=0,triangles=0;
      asset.scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;o.material=fabricMaterial('#879a7a');o.castShadow=o.receiveShadow=true;}});
      const bounds=new T.Box3().setFromObject(asset.scene);
      const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,850);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
      document.body.replaceChildren(renderer.domElement);document.body.style.margin='0';
      const scene=new T.Scene();scene.background=new T.Color('#e7ded0');
      if(bedStudy){
        const bedroomSource=await (await fetch('/src/modules/walkthrough/builders/furniture/bedroom.ts')).text();
        const dependency=bedroomSource.match(/from\s+["']([^"']*model-throw\.ts[^"']*)["']/);
        if(!dependency)throw new Error('Missing cloth registration dependency');
        const {installDrapedThrow}=await import(dependency[1]);installDrapedThrow(asset.scene);
        const upholsterySource=await (await fetch('/src/modules/walkthrough/builders/furniture/upholstery.ts')).text();
        const pillowDependency=upholsterySource.match(/from\s+["']([^"']*model-armchair\.ts[^"']*)["']/);
        if(!pillowDependency)throw new Error('Missing pillow source dependency');
        const {prepareArmchairModel}=await import(pillowDependency[1]);
        if(!await prepareArmchairModel(true))throw new Error('Pillow model failed to load');
        const {buildBedDouble}=await import('/src/modules/walkthrough/builders/furniture/bedroom.ts');
        const bed=new T.Group();buildBedDouble(bed,{id:'cloth-fit',type:'bed-double',position:{x:0,y:0},rotation:0,size:{width:150,depth:200,height:45}},280);
        if(!bed.children.some(child=>child.name==='simulated-bed-throw'))throw new Error('Candidate was not used by bed builder');
        scene.add(bed);
      }else scene.add(asset.scene);
      const studio=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer),env=pmrem.fromScene(studio,.04);scene.environment=env.texture;studio.dispose();pmrem.dispose();
      const mattress=new T.Mesh(new RoundedBoxGeometry(1.41,.2025,1.86,4,.055),new T.MeshStandardMaterial({color:'#e9e3d8',roughness:.9}));mattress.position.set(0,.34875,.03);mattress.receiveShadow=true;if(!bedStudy)scene.add(mattress);
      const sun=new T.DirectionalLight('#fff2dc',1.8);sun.position.set(-2,4,3);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
      Object.assign(sun.shadow.camera,{left:-2,right:2,top:2,bottom:-2});sun.shadow.normalBias=.003;scene.add(sun,new T.HemisphereLight('#eee9df','#aa9987',.55));
      const camera=new T.PerspectiveCamera(35,1200/850,.01,100);camera.position.set(2.3,2.3,-3.3);camera.lookAt(0,.5,-.15);
      window.renderCloth=(view=0)=>{
        if(bedStudy){camera.position.set(...[[2.3,2.3,3.3],[-2.3,1.4,-3.3],[0,3.8,.5]][view]);camera.lookAt(0,.4,0);}
        renderer.render(scene,camera);
      };window.renderCloth();
      return {meshes,triangles,min:bounds.min.toArray(),max:bounds.max.toArray()};
    },bedStudy);
    await page.waitForTimeout(1500);await page.evaluate(()=>window.renderCloth());
    await page.screenshot({path:bedStudy?'docs/images/draped-throw-bed-front.png':'docs/images/draped-throw-asset-study.png'});
    if(bedStudy)for(const [view,label] of [[1,'back'],[2,'top']]){
      await page.evaluate(view=>window.renderCloth(view),view);
      await page.screenshot({path:`docs/images/draped-throw-bed-${label}.png`});
    }
    expect(errors).toEqual([]);expect(report.meshes).toBe(1);expect(report.triangles).toBeLessThan(6000);
    expect(report.min[1]).toBeLessThan(.4);expect(report.min[1]).toBeGreaterThan(.03);expect(report.max[1]).toBeLessThan(.55);
    expect(report.max[2]-report.min[2]).toBeGreaterThan(.9);
    console.log('Offline simulated cloth, static runtime asset:',report);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
