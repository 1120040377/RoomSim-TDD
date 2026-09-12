const { chromium } = require('@playwright/test');
(async () => {
 const browser = await chromium.launch();
 try {
  const page = await browser.newPage({viewport:{width:1200,height:800}});
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5175/');
  await page.evaluate(async()=>{
   const T=await import('/node_modules/three/build/three.module.js');
   const {buildTelevision}=await import('/src/modules/walkthrough/builders/furniture/television.ts');
   const {RoomEnvironment}=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
   document.body.replaceChildren(); document.body.style.margin='0';
   const renderer=new T.WebGLRenderer({antialias:true}); renderer.setSize(1200,800);
   renderer.toneMapping=T.ACESFilmicToneMapping; document.body.appendChild(renderer.domElement);
   const scene=new T.Scene(); scene.background=new T.Color('#d9d4cb');
   const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();
   scene.environment=pmrem.fromScene(room).texture;
   scene.add(new T.HemisphereLight('#ffffff','#898073',2));
   const sun=new T.DirectionalLight('#fff3e0',3); sun.position.set(-2,3,-4); scene.add(sun);
   const tv=new T.Group();buildTelevision(tv,{size:{width:130,height:75,depth:10}});scene.add(tv);
   const camera=new T.PerspectiveCamera(34,1.5,.01,100);
   camera.position.set(1.25,.92,-2.15); camera.lookAt(0,.38,0);
   renderer.render(scene,camera);
   window.tvStudy={renderer,scene,camera};
  });
  await page.screenshot({path:'docs/images/television-front-study.png'});
  await page.evaluate(()=>{const {renderer,scene,camera}=window.tvStudy;camera.position.set(1.5,.85,1.8);camera.lookAt(0,.38,0);renderer.render(scene,camera);});
  await page.screenshot({path:'docs/images/television-rear-study.png'});
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Front and rear render checks passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
