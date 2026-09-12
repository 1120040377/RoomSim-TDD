// Keep idle reuse separate: idle RAF cadence is not rendered FPS.
function summarizeFrames(frames) {
  const rendered = frames.filter(frame => frame.rendered === 1);
  // A RAF interval belongs to the PREVIOUS loop's work. The next loop may be
  // cached, but its delay still includes the preceding render/GPU wait.
  const completed = frames.slice(1).filter((frame,index)=>frames[index].rendered===1 && Number.isFinite(frame.frameMs) && frame.frameMs>=0);
  const distribution = (key, samples=rendered) => {
    const values = samples.map(frame => frame[key]).filter(value => typeof value === 'number' && Number.isFinite(value) && value >= 0).sort((a,b) => a-b);
    const percentile = fraction => values.length ? values[Math.max(0,Math.ceil(values.length*fraction)-1)] : null;
    return { samples: values.length, median: percentile(.5), p95: percentile(.95), max: percentile(1) };
  };
  return {
    samples: frames.length, rendered: rendered.length, cached: frames.filter(frame => frame.rendered === 0).length,
    frameMs: distribution('frameMs',completed), gpuMs: distribution('gpuMs'),
    controlsMs: distribution('controlsMs'), occlusionMs: distribution('occlusionMs'),
    logicMs: distribution('logicMs'), shadowCheckMs: distribution('shadowCheckMs'),
    frameCheckMs: distribution('frameCheckMs'), renderSubmitMs: distribution('renderSubmitMs'),
    over33msRatio: completed.length ? completed.filter(frame => frame.frameMs > 33.33).length/completed.length : null,
    gpuStatuses: rendered.reduce((counts,frame) => {
      if (typeof frame.gpuMs !== 'number') { const status=frame.gpuMs ?? 'missing'; counts[status]=(counts[status]??0)+1; }
      return counts;
    },{}),
  };
}
module.exports = { summarizeFrames };
