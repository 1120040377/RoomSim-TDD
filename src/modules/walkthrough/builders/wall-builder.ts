import { BoxGeometry, Group, Mesh, PlaneGeometry, type BufferGeometry, type Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Opening, Plan, Wall } from '@/modules/model/types';
import { splitWallIntoSlabs } from '@/modules/geometry/opening-cut';
import { CM_TO_M, toYawFromEditorAngle, wallAngle, wallLengthCm } from '../coord';
import { wallMaterial } from './finish-material';
import { CUTAWAY_HEIGHT, interiorWallIds } from '../inspection-cutaway';
import { VerticalWallCaps } from '../vertical-wall-caps';
import { removeInternalWallFaces } from './remove-internal-wall-faces';
import { buildBaseboards } from './baseboards';

const WALL_COLOR = 0xf5f0e8;

export interface BuildWallsResult {
  group: Group;
  verticalCaps: VerticalWallCaps;
  /** 墙 id → 由该墙生成的 slab Mesh 列表（便于后续做选中高亮） */
  meshesByWallId: Record<string, Mesh[]>;
}

export function buildWalls(plan: Plan): BuildWallsResult {
  const group = new Group();
  group.name = 'walls';
  const meshesByWallId: Record<string, Mesh[]> = {};

  const material = wallMaterial(plan.renovation?.finish.wallColor ?? WALL_COLOR);
  const interiorMaterial = material.clone();
  interiorMaterial.userData.interiorPartition = true;
  const interiorWalls = interiorWallIds(plan);
  const capGeometry:BufferGeometry[][]=[[],[]];

  for (const wall of Object.values(plan.walls)) {
    const openings = Object.values(plan.openings).filter((o) => o.wallId === wall.id);
    const { group: g, meshes } = buildSingleWall(wall, openings, plan, interiorWalls.has(wall.id) ? interiorMaterial : material);
    group.add(g);
    meshesByWallId[wall.id] = meshes;
    for(const mesh of meshes){
      const dimensions=(mesh.geometry as BoxGeometry).parameters;
      const bottom=mesh.position.y-dimensions.height/2,top=mesh.position.y+dimensions.height/2;
      // Open doors/windows stay open: only slab volumes intersecting this
      // height receive a cap, never a rectangle over the whole wall.
      if(bottom>=CUTAWAY_HEIGHT||top<=CUTAWAY_HEIGHT)continue;
      const cap=new PlaneGeometry(dimensions.width,dimensions.depth);
      cap.rotateX(-Math.PI/2);cap.rotateY(mesh.rotation.y);
      cap.translate(mesh.position.x,CUTAWAY_HEIGHT,mesh.position.z);
      capGeometry[interiorWalls.has(wall.id)?1:0].push(cap);
    }
  }

  const baseboards=buildBaseboards(plan,Object.values(meshesByWallId).flat(),material);
  if(baseboards)group.add(baseboards);
  removeInternalWallFaces(Object.values(meshesByWallId).flat());
  const caps=new Group();caps.name='cutaway-caps';
  for(const [index,geometries] of capGeometry.entries()){
    if(!geometries.length)continue;
    const merged=mergeGeometries(geometries,false);
    for(const geometry of geometries)geometry.dispose();
    if(!merged)continue;
    const surface=material.clone();surface.userData={cutawayCap:true,interiorPartition:index===1};
    const cap=new Mesh(merged,surface);cap.userData.cutawayCap=true;
    cap.visible=false;cap.receiveShadow=true;caps.add(cap);
  }
  if(caps.children.length)group.add(caps);
  const verticalCaps=new VerticalWallCaps(Object.values(meshesByWallId).flat(),material);
  group.add(verticalCaps.mesh);

  return { group, meshesByWallId, verticalCaps };
}

function buildSingleWall(
  wall: Wall,
  openings: Opening[],
  plan: Plan,
  material: ReturnType<typeof wallMaterial>,
): { group: Group; meshes: Mesh[] } {
  const g = new Group();
  g.name = `wall-${wall.id}`;
  (g as Object3D & { userData: Record<string, unknown> }).userData = { wallId: wall.id };

  const s = plan.nodes[wall.startNodeId];
  const e = plan.nodes[wall.endNodeId];
  if (!s || !e) return { group: g, meshes: [] };

  const length = wallLengthCm(s.position, e.position);
  const angle = wallAngle(s.position, e.position);
  const yaw = toYawFromEditorAngle(angle);

  const slabs = splitWallIntoSlabs(length, openings, wall.height);
  const meshes: Mesh[] = [];

  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  for (const slab of slabs) {
    const geom = new BoxGeometry(
      slab.length * CM_TO_M,
      slab.height * CM_TO_M,
      wall.thickness * CM_TO_M,
    );
    // Metre-scale UVs continue across slabs created by door/window openings.
    // Default BoxGeometry UVs stretch one swatch over every differently sized slab.
    const positions=geom.getAttribute('position'),normals=geom.getAttribute('normal'),uv=geom.getAttribute('uv');
    for(let i=0;i<positions.count;i++){
      const along=positions.getX(i)+(slab.startOffset+slab.length/2)*CM_TO_M;
      const height=positions.getY(i)+(slab.bottomZ+slab.height/2)*CM_TO_M;
      const depth=positions.getZ(i);
      if(Math.abs(normals.getY(i))>0.5)uv.setXY(i,along,depth);
      else if(Math.abs(normals.getX(i))>0.5)uv.setXY(i,depth,height);
      else uv.setXY(i,along,height);
    }
    const mesh = new Mesh(geom, material);

    // 墙中心沿墙方向 startOffset + length/2 的 editor 位置
    const alongWall = slab.startOffset + slab.length / 2;
    const editorX = s.position.x + cosA * alongWall;
    const editorY = s.position.y + sinA * alongWall;

    mesh.position.set(
      editorX * CM_TO_M,
      (slab.bottomZ + slab.height / 2) * CM_TO_M,
      editorY * CM_TO_M,
    );
    mesh.rotation.y = yaw;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `wall-${wall.id}-slab`;
    (mesh as Object3D & { userData: Record<string, unknown> }).userData = { wallId: wall.id };

    g.add(mesh);
    meshes.push(mesh);
  }

  return { group: g, meshes };
}
