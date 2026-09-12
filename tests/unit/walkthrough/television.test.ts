import { describe, it, expect, vi } from 'vitest';
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { buildTv } from '@/modules/walkthrough/builders/furniture/livingroom';
import { batchStaticParts } from '@/modules/walkthrough/builders/batch-static-parts';
import { useObject } from '@/modules/walkthrough/life';
import type { Furniture } from '@/modules/model/types';

describe('television', () => {
  it('keeps placement bounds and toggles video after batching', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    const f: Furniture = { id: 'tv', type: 'tv', position: { x: 0, y: 0 }, rotation: 0, size: { width: 130, height: 75, depth: 10 } };
    const g = new Group();
    buildTv(g, f, 280);
    batchStaticParts(g);
    const bounds = new Box3().setFromObject(g), size = bounds.getSize(new Vector3());
    expect(size.x).toBeCloseTo(1.3, 4);
    expect(size.y).toBeCloseTo(0.75, 4);
    expect(size.z).toBeLessThan(0.102);
    expect(bounds.min.y).toBeCloseTo(0, 4);
    const screen = g.getObjectByName('tv-screen') as Mesh;
    expect(screen).toBeDefined();
    const material = screen.material as MeshStandardMaterial;
    useObject(g, f);
    await Promise.resolve();
    const videoSurface = screen.getObjectByName('tv-video') as Mesh;
    await vi.waitFor(() => expect(videoSurface.visible).toBe(true));
    g.traverse(child => {
      if (child instanceof Mesh && child !== screen && child.name !== 'tv-video' && !child.userData.tvIndicator)
        expect((child.material as MeshStandardMaterial).emissive.getHex()).toBe(0);
    });
    useObject(g, f);
    expect(material.emissive.getHex()).toBe(0);
    expect(videoSurface.visible).toBe(false);
    expect(pause).toHaveBeenCalled();
    (videoSurface.material as MeshStandardMaterial).dispose();
    vi.restoreAllMocks();
  });
});
