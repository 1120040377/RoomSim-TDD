import { expect, it, vi } from 'vitest';
import { GpuFrameTimer } from '@/modules/walkthrough/gpu-frame-timer';

function context(supported = true) {
  const gl = {
    getExtension: vi.fn(() => supported ? { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 } : null),
    isContextLost: vi.fn(() => false), getParameter: vi.fn(() => false),
    createQuery: vi.fn(() => ({})), beginQuery: vi.fn(), endQuery: vi.fn(), deleteQuery: vi.fn(),
    QUERY_RESULT_AVAILABLE: 3, QUERY_RESULT: 4,
    getQueryParameter: vi.fn((_query: unknown, parameter: number): number | boolean => parameter === 3 ? false : 12500000),
  };
  return { gl, timer: new GpuFrameTimer(gl as unknown as WebGL2RenderingContext) };
}

it('仅就绪后读取结果，回填原采样而非当前帧，纳秒转毫秒', () => {
  const { gl, timer } = context(); const report = vi.fn();
  expect(timer.begin(report)).toBe(true); timer.end();
  timer.begin(vi.fn()); timer.end();
  expect(report).not.toHaveBeenCalled();
  expect(gl.getQueryParameter.mock.calls.every(([, parameter]) => parameter === 3)).toBe(true);
  gl.getQueryParameter.mockImplementation((_q, parameter) => parameter === 3 ? true : 12500000);
  timer.begin(vi.fn()); timer.end();
  expect(report).toHaveBeenCalledWith(12.5); timer.dispose();
});

it('未完成队列最多四项，不阻塞等待、不持续分配', () => {
  const { gl, timer } = context();
  for (let i = 0; i < 100; i++) { timer.begin(vi.fn()); timer.end(); }
  expect(gl.createQuery).toHaveBeenCalledTimes(4);
  timer.dispose(); expect(gl.deleteQuery).toHaveBeenCalledTimes(4);
  expect(timer.begin(vi.fn())).toBe(false);
});

it('计时失效后丢弃全部旧结果，结束活动查询并释放', () => {
  const { gl, timer } = context(); const report = vi.fn();
  timer.begin(report); timer.end(); gl.getParameter.mockReturnValue(true);
  expect(timer.begin(vi.fn())).toBe(false);
  expect(report).toHaveBeenCalledWith(null); expect(gl.deleteQuery).toHaveBeenCalledTimes(1);
  gl.getParameter.mockReturnValue(false); timer.begin(report); timer.dispose();
  expect(gl.endQuery).toHaveBeenCalledTimes(2); expect(gl.deleteQuery).toHaveBeenCalledTimes(2);
});

it('扩展不支持或上下文丢失时不发起查询', () => {
  const { gl, timer } = context(false);
  expect(timer.supported).toBe(false); expect(timer.begin(vi.fn())).toBe(false);
  expect(gl.createQuery).not.toHaveBeenCalled(); timer.dispose();
  const lost = context(); lost.gl.isContextLost.mockReturnValue(true);
  expect(lost.timer.begin(vi.fn())).toBe(false); lost.timer.dispose();
});

it('画面缓存时仍可回收上一帧查询，不发起新的计时',()=>{
  const {gl,timer}=context(),report=vi.fn();timer.begin(report);timer.end();
  gl.getQueryParameter.mockImplementation((_q,parameter)=>parameter===3?true:12500000);
  expect(timer.poll()).toBe(true);expect(report).toHaveBeenCalledWith(12.5);
  expect(gl.createQuery).toHaveBeenCalledTimes(1);expect(gl.deleteQuery).toHaveBeenCalledTimes(1);timer.dispose();
});
