const { chromium } = require('@playwright/test');
(async () => {
 const browser = await chromium.launch();
 try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5175/');
  await page.evaluate(async () => {
   const T=await import('/node_modules/three/build/three.module.js');
   const kitchen=await import('/src/modules/walkthrough/builders/furniture/kitchen.ts');
   const bathroom=await import('/src/modules/walkthrough/builders/furniture/bathroom.ts');
   const { useObject }=await import('/src/modules/walkthrough/life.ts');
   const { animateWater }=await import('/src/modules/walkthrough/water-effect.ts');
   const { RoomEnvironment }=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
   document.body.replaceChildren(); document.body.style.margin='0';
   const renderer=new T.WebGLRenderer({antialias:true}); renderer.setSize(1100,900);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.appendChild(renderer.domElement);
   const scene=new T.Scene();scene.background=new T.Color('#54635e');
   const pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment()).texture;
   scene.add(new T.HemisphereLight('#ffffff','#697a6a',2));const sun=new T.DirectionalLight('#fff1dc',3);sun.position.set(-2,4,-3);scene.add(sun);
   const camera=new T.PerspectiveCamera(36,1100/900,.01,100),fixtures=new T.Group();scene.add(fixtures);
   window.waterStudy={T,kitchen,bathroom,useObject,animateWater,renderer,scene,camera,fixtures};
  });
  for(const type of ['sink','basin','shower','bathtub']) {
   await page.evaluate((type)=>{
    const {T,kitchen,bathroom,useObject,animateWater,renderer,scene,camera,fixtures}=window.waterStudy;
    fixtures.clear();
    const sizes={sink:[80,60,85],basin:[60,50,85],shower:[90,90,200],bathtub:[170,80,55]};const [width,depth,height]=sizes[type];
    const f={id:type,type,size:{width,depth,height},position:{x:0,y:0},rotation:0},g=new T.Group();
    ({sink:kitchen.buildSink,basin:bathroom.buildBasin,shower:bathroom.buildShower,bathtub:bathroom.buildBathtub})[type](g,f,280); fixtures.add(g);useObject(g,f);animateWater(fixtures,.1);
    if(type==='shower'){camera.position.set(-1.9,1.9,2.5);camera.lookAt(0,.95,0);}
    else if(type==='bathtub'){camera.position.set(1.9,1.9,-2.1);camera.lookAt(0,.36,0);}
    else{camera.position.set(1.05,1.65,-1.4);camera.lookAt(0,.77,.02);}
    renderer.render(scene,camera);
   },type);
   await page.screenshot({path:`docs/images/water-${type}-study.png`});
  }
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Four fixture water renders passed.');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
