import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, VideoTexture } from 'three';

type Player = { video: HTMLVideoElement; surface: Mesh; dispose: () => void };
const players = new WeakMap<Group, Player>();

/** Called directly from the interaction gesture so browsers can allow audio. */
export function toggleTv(group: Group, report?: (message: string) => void): string {
  const screen = group.getObjectByName('tv-screen');
  if (!(screen instanceof Mesh)) return '未找到电视屏幕';
  let player = players.get(group);
  if (group.userData.on) {
    group.userData.on = false;
    if (player) { player.video.pause(); player.surface.visible = false; }
    return '电视已关闭';
  }
  if (!player) {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.loop = true;
    video.preload = 'metadata';
    video.volume = 0.35;
    video.src = import.meta.env.VITE_TV_VIDEO_URL || `${import.meta.env.BASE_URL}videos/flower.mp4`;
    const texture = new VideoTexture(video);
    texture.colorSpace = SRGBColorSpace;
    const material = new MeshBasicMaterial({ map: texture, toneMapped: false });
    const surface = new Mesh(new PlaneGeometry(1, 1), material);
    surface.name = 'tv-video';
    surface.rotation.y = Math.PI;
    surface.position.z = -0.001;
    surface.visible = false;
    screen.add(surface);
    screen.geometry.computeBoundingBox();
    const bounds = screen.geometry.boundingBox!;
    const width = bounds.max.x - bounds.min.x, height = bounds.max.y - bounds.min.y;
    const fit = () => {
      const aspect = video.videoWidth / video.videoHeight || 16 / 9;
      const w = Math.min(width, height * aspect);
      surface.scale.set(w, w / aspect, 1);
    };
    fit(); video.addEventListener('loadedmetadata', fit);
    const fail = () => {
      if (!group.userData.on) return;
      group.userData.on = false; surface.visible = false; video.pause();
      report?.('视频无法播放，请检查电视视频文件或链接');
    };
    video.addEventListener('error', fail);
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      group.userData.on = false;
      video.removeEventListener('loadedmetadata', fit);
      video.removeEventListener('error', fail);
      video.pause(); video.removeAttribute('src'); video.load();
      texture.dispose();
      players.delete(group);
    };
    // Existing scene/furniture teardown disposes materials even while the TV is off.
    material.addEventListener('dispose', dispose);
    player = { video, surface, dispose };
    players.set(group, player);
  }
  group.userData.on = true;
  const current = player;
  void current.video.play().then(() => {
    if (!group.userData.on) return;
    current.surface.visible = true;
    report?.('电视正在播放');
  }).catch(() => {
    if (!group.userData.on) return;
    group.userData.on = false;
    current.surface.visible = false;
    report?.('视频未能播放，请检查视频文件后重新开启电视');
  });
  return '电视正在加载视频…';
}
