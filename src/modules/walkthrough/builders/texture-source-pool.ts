import { Texture, TextureLoader } from 'three';

const sources = new Map<string, { texture: Texture; users: Set<Texture> }>();

/** Share image/GPU storage while each consumer keeps independent UV transforms.
 * Three r160 keys GPU allocations by Source + sampler settings, not Texture id.
 * Consumers own their returned texture and must dispose it as usual.
 */
export function loadSharedTexture(url: string): Texture {
  let entry = sources.get(url);
  if (!entry) {
    const users = new Set<Texture>();
    const texture = new TextureLoader().load(url, () => {
      for (const user of users) user.needsUpdate = true;
    });
    entry = { texture, users };
    sources.set(url, entry);
  }
  const owner = entry;
  const texture = owner.texture.clone();
  owner.users.add(texture);
  const release = () => {
    texture.removeEventListener('dispose', release);
    owner.users.delete(texture);
    if (!owner.users.size) {
      if (sources.get(url) === owner) sources.delete(url);
      owner.texture.dispose();
    }
  };
  texture.addEventListener('dispose', release);
  return texture;
}
