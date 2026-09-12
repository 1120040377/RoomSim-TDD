const { chromium } = require('@playwright/test');
(async () => {
 const browser = await chromium.launch();
 try {
  const page = await browser.newPage({viewport:{width:1200,height:800}});
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5175/');
  await page.evaluate(async()=>{
   const T=await import('/node_modules/three/build/three.module.js');
   const {buildStylizedAvatar}=await import('/src/modules/walkthrough/builders/stylized-avatar.ts');
   const {RoomEnvironment}=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
   document.body.replaceChildren(); document.body.style.margin='0';
   const renderer=new T.WebGLRenderer({antialias:true}); renderer.setSize(1200,800);
   renderer.toneMapping=T.ACESFilmicToneMapping; renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap; document.body.appendChild(renderer.domElement);
   const scene=new T.Scene(); scene.background=new T.Color('#d9d4cb');
   const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();
   scene.environment=pmrem.fromScene(room).texture;
   scene.add(new T.HemisphereLight('#ffffff','#898073',2));
   const sun=new T.DirectionalLight('#fff3e0',3); sun.position.set(-2,3,-4); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-2; sun.shadow.camera.right=2; sun.shadow.camera.top=2; sun.shadow.camera.bottom=-2; sun.shadow.normalBias=.015; scene.add(sun);
   const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#d9d4cb',roughness:1})); floor.rotation.x=-Math.PI/2; floor.position.y=-.002; floor.receiveShadow=true; scene.add(floor);
   const adult=buildStylizedAvatar('adult'),child=buildStylizedAvatar('child');adult.group.position.x=-.4;child.group.position.x=.4;child.group.scale.setScalar(1.2/1.7);scene.add(adult.group,child.group);window.avatars=[adult,child];
   const camera=new T.PerspectiveCamera(34,1.5,.01,100);
   camera.position.set(1.1,1.3,-4.1); camera.lookAt(0,.85,0);
   renderer.render(scene,camera);
   window.tvStudy={renderer,scene,camera,T};
  });
  await page.screenshot({path:'docs/images/avatars-front-study.png'});
  await page.evaluate(()=>{const {renderer,scene,camera,T}=window.tvStudy;window.avatars.forEach(a=>{a.pose('sit');a.group.position.y-=new T.Box3().setFromObject(a.group).min.y;});camera.position.set(2,1.2,-3.5);camera.lookAt(0,.65,0);renderer.render(scene,camera);});
  await page.screenshot({path:'docs/images/avatars-seated-study.png'});
  await page.evaluate(()=>{const {renderer,scene,camera}=window.tvStudy;window.avatars.forEach(a=>{a.pose('stand');a.group.position.y=0;});camera.position.set(-1.8,1.4,3.8);camera.lookAt(0,.85,0);renderer.render(scene,camera);});
  await page.screenshot({path:'docs/images/avatars-rear-study.png'});
  await page.evaluate(()=>{const {renderer,scene,camera,T}=window.tvStudy;window.avatars.forEach(a=>{a.pose('lie');a.group.position.y-=new T.Box3().setFromObject(a.group).min.y;});camera.position.set(2,2.7,-2.4);camera.lookAt(0,.1,-.6);renderer.render(scene,camera);});
  await page.screenshot({path:'docs/images/avatars-lying-study.png'});
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Front, seated, rear and lying render checks passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
