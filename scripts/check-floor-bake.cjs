const {chromium}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');
    const result=await page.evaluate(async()=>{
      const {FloorBake}=await import('/src/modules/walkthrough/baking/floor-bake.ts');
      const {materialShowroom}=await import('/src/modules/templates/apartments/material-showroom.ts');
      const {buildWalls}=await import('/src/modules/walkthrough/builders/wall-builder.ts');
      const {buildFurniture}=await import('/src/modules/walkthrough/builders/furniture-builder.ts');
      const {buildFloor}=await import('/src/modules/walkthrough/builders/floor-builder.ts');
      const {prepareArmchairModel}=await import('/src/modules/walkthrough/builders/furniture/model-armchair.ts');
      await prepareArmchairModel();
      const plan=materialShowroom.build('Full floor bake lifecycle');
      const floor=buildFloor(plan),roots=[buildWalls(plan).group,buildFurniture(plan)];
      const finishes=floor.children.filter(mesh=>mesh.userData.roomId);
      const original=finishes.map(mesh=>mesh.material.aoMap);
      const bake=new FloorBake();let ticks=0;const timer=setInterval(()=>ticks++,10);
      try{
        const started=performance.now();
        const accepted=await bake.start(roots,floor,{minX:0,minZ:0,width:11.4,depth:8});
        const totalMs=performance.now()-started;
        const texture=finishes[0].material.aoMap;let disposed=0;
        texture.addEventListener('dispose',()=>disposed++);
        const applied=finishes.every(mesh=>mesh.material.aoMap===texture&&mesh.geometry.hasAttribute('uv1'));
        const textureBytes=texture.image.data.byteLength;
        bake.invalidate();
        const restored=finishes.every((mesh,i)=>mesh.material.aoMap===original[i]&&!mesh.geometry.hasAttribute('uv1'));
        bake.dispose();
        return {accepted,applied,restored,disposed,textureBytes,totalMs,ticks};
      }finally{clearInterval(timer);bake.dispose();}
    });
    if(!result.accepted||!result.applied||!result.restored||result.disposed!==1||result.ticks<1||errors.length)
      throw new Error(JSON.stringify({result,errors}));
    console.log('Full showroom floor bake lifecycle (not FPS):',result);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
