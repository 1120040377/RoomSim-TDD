import { afterEach, expect, it, vi } from 'vitest';
import { Texture, TextureLoader } from 'three';
import { loadSharedTexture } from '@/modules/walkthrough/builders/texture-source-pool';

afterEach(() => { vi.restoreAllMocks(); });

it('共享来源但保留独立 UV；最后一个使用者退出才移除来源', () => {
  const load = vi.spyOn(TextureLoader.prototype, 'load').mockImplementation(() => new Texture());
  const a = loadSharedTexture('/test-oak.jpg'), b = loadSharedTexture('/test-oak.jpg');
  expect(load).toHaveBeenCalledTimes(1);
  expect(a).not.toBe(b); expect(a.source).toBe(b.source);
  a.offset.set(0.3, 0.4); expect(b.offset.toArray()).toEqual([0, 0]);
  a.dispose();
  const c = loadSharedTexture('/test-oak.jpg');
  expect(c.source).toBe(b.source); expect(load).toHaveBeenCalledTimes(1);
  b.dispose(); c.dispose();
  const d = loadSharedTexture('/test-oak.jpg');
  expect(load).toHaveBeenCalledTimes(2); expect(d.source).not.toBe(c.source);
  d.dispose();
});

it('异步图片完成后更新存活副本；提前销毁不影响其他使用者', () => {
  let finish: ((texture: Texture) => void) | undefined;
  const source = new Texture();
  vi.spyOn(TextureLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
    finish = onLoad; return source;
  });
  const a = loadSharedTexture('/async.jpg'), b = loadSharedTexture('/async.jpg');
  a.dispose(); const av = a.version, bv = b.version;
  source.image = { width: 16, height: 16 }; finish!(source);
  expect(a.version).toBe(av); expect(b.version).toBeGreaterThan(bv);
  expect(b.image).toBe(source.image); b.dispose();
});
