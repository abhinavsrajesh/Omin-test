import React, { useEffect, useRef } from 'react';

export default function PathMap({ points, onClose }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const mapCanvas = canvasRef.current;
    const ctx = mapCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = mapCanvas.clientWidth;
    const h = mapCanvas.clientHeight;
    
    mapCanvas.width = w * dpr;
    mapCanvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    if (points.length === 0) {
      ctx.fillStyle = '#8a929b';
      ctx.font = '14px sans-serif';
      ctx.fillText('No points captured yet.', 20, 30);
      return;
    }

    // project x/z (top-down), fit to canvas with padding
    const xs = points.map(p => p.x);
    const zs = points.map(p => p.z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const pad = 50;
    const spanX = Math.max(0.5, maxX - minX);
    const spanZ = Math.max(0.5, maxZ - minZ);
    const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanZ);

    function toScreen(p) {
      return {
        sx: pad + (p.x - minX) * scale,
        sy: pad + (p.z - minZ) * scale
      };
    }

    // edges
    ctx.strokeStyle = '#3ddc97';
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => {
      const s = toScreen(p);
      if (i === 0) ctx.moveTo(s.sx, s.sy); 
      else ctx.lineTo(s.sx, s.sy);
    });
    ctx.stroke();

    // distance labels on edges
    ctx.fillStyle = '#8a929b';
    ctx.font = '11px sans-serif';
    for (let i = 1; i < points.length; i++) {
      const a = toScreen(points[i - 1]);
      const b = toScreen(points[i]);
      const mx = (a.sx + b.sx) / 2;
      const my = (a.sy + b.sy) / 2;
      ctx.fillText(points[i].distFromPrev.toFixed(1) + 'm', mx + 4, my - 4);
    }

    // nodes
    points.forEach((p, i) => {
      const s = toScreen(p);
      ctx.beginPath();
      ctx.arc(s.sx, s.sy, 7, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#e2574c' : '#14171c';
      ctx.fill();
      ctx.strokeStyle = '#3ddc97';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#eef1f3';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`${i + 1}. ${p.label}`, s.sx + 10, s.sy + 4);
    });
  }, [points]);

  const totalDistance = points.reduce((acc, p) => acc + (p.distFromPrev || 0), 0);

  return (
    <div className="map-screen show">
      <div className="map-header">
        <div>
          <h2>Auto-generated Node Map</h2>
          <span>{points.length} points, {totalDistance.toFixed(1)} m total</span>
        </div>
        <button className="btn btn-secondary" onClick={onClose} style={{padding: '8px 14px', fontSize: '13px'}}>Back</button>
      </div>
      <canvas ref={canvasRef} className="map-canvas"></canvas>
      <div className="map-footer">Top-down projection of your captured path (x/z axes).</div>
    </div>
  );
}
