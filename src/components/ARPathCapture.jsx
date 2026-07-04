import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { savePath } from '../services/pathService';
import PathMap from './PathMap';

const POI_LABELS = ['Entrance', 'Junction', 'CT Scan', 'Lab', 'Pharmacy', 'Ward', 'Lift', 'Stairs', 'Reception'];

export default function ARPathCapture(props) {
  const [points, setPoints] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const currentPoseRef = useRef(null);
  const xrSessionRef = useRef(null);

  useEffect(() => {
    // Check WebXR Support
    if (!navigator.xr) {
      setIsSupported(false);
      return;
    }
    navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
      setIsSupported(supported);
      // Do NOT init3D here. Wait for user click.
    });

    return () => {
      // Cleanup
      if (rendererRef.current) {
        rendererRef.current.setAnimationLoop(null);
        if (document.body.contains(rendererRef.current.domElement)) {
          document.body.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, []);

  const handleStartARClick = () => {
    init3D();
  };

  const init3D = () => {
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 40);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Explicitly set transparent background
    renderer.xr.enabled = true;
    rendererRef.current = renderer;

    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.zIndex = '1';
    document.body.appendChild(renderer.domElement);
    
    // We don't append to containerRef anymore to match OMNINAV exactly

    const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    scene.add(light);

    // Create AR Button exactly like OMNINAV.html
    const button = ARButton.createButton(renderer, { requiredFeatures: ['local-floor'] });
    button.style.display = 'none';
    document.body.appendChild(button);
    
    // Auto-click it to start the session immediately
    button.click();

    renderer.xr.addEventListener('sessionstart', () => {
      xrSessionRef.current = renderer.xr.getSession();
      setIsLive(true);
      if (props.onLiveStateChange) props.onLiveStateChange(true);
      document.body.classList.add('ar-live-mode');
    });

    renderer.xr.addEventListener('sessionend', () => {
      setIsLive(false);
      if (props.onLiveStateChange) props.onLiveStateChange(false);
      document.body.classList.remove('ar-live-mode');
      
      // Cleanup WebGL context so it can be restarted fresh
      if (rendererRef.current) {
        if (document.body.contains(rendererRef.current.domElement)) {
          document.body.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
      }
    });

    renderer.setAnimationLoop((time, frame) => {
      if (frame) {
        const refSpace = renderer.xr.getReferenceSpace();
        const pose = frame.getViewerPose(refSpace);
        if (pose) {
          const p = pose.transform.position;
          currentPoseRef.current = { x: p.x, y: p.y, z: p.z };
        }
      }
      renderer.render(scene, camera);
    });

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
  };

  const dist3D = (a, b) => {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
  };

  const addMarkerMesh = (x, y, z, color = 0x3ddc97) => {
    if (!sceneRef.current) return;
    const geo = new THREE.SphereGeometry(0.06, 16, 16);
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    sceneRef.current.add(mesh);
    return mesh;
  };

  const handleAddPoint = () => {
    if (!currentPoseRef.current) return;
    
    setPoints(prevPoints => {
      const label = POI_LABELS[Math.min(prevPoints.length, POI_LABELS.length - 1)] + 
                    (prevPoints.length >= POI_LABELS.length ? ` ${prevPoints.length}` : '');
      
      let distFromPrev = 0;
      if (prevPoints.length > 0) {
        distFromPrev = dist3D(prevPoints[prevPoints.length - 1], currentPoseRef.current);
      }
      
      const newPoint = { ...currentPoseRef.current, label, distFromPrev };
      
      // Add mesh to scene
      addMarkerMesh(newPoint.x, newPoint.y, newPoint.z, prevPoints.length === 0 ? 0xe2574c : 0x3ddc97);
      
      if (navigator.vibrate) navigator.vibrate(30);
      return [...prevPoints, newPoint];
    });
  };

  const handleUndo = () => {
    if (points.length === 0) return;
    setPoints(prev => {
      const newPoints = [...prev];
      newPoints.pop(); // Remove last
      // Note: In a full app, you'd also remove the Mesh from the Three.js scene here.
      // For this demo, we'll just remove it from state.
      return newPoints;
    });
  };

  const handleSaveToCloud = async () => {
    if (points.length === 0) return;
    try {
      setIsSaving(true);
      await savePath("AR Walkthrough " + new Date().toLocaleTimeString(), points);
      alert("Path successfully saved to Firestore!");
      setShowMap(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save path. Check console.");
    } finally {
      setIsSaving(false);
    }
  };

  const totalDistance = points.reduce((acc, p) => acc + (p.distFromPrev || 0), 0);

  if (!isSupported) {
    return (
      <div className="error-message" style={{position: 'relative', transform: 'none', left: 0, top: 0, margin: '2rem'}}>
        WebXR AR isn't available on this browser/device. Try Chrome on an ARCore-capable Android phone.
      </div>
    );
  }

  return (
    <div className="ar-container" ref={containerRef}>
      {/* The 3D canvas is appended to document.body, not here */}

      {!isLive && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '1rem' }}>Ready to capture path</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Walk the corridor naturally and drop points.
          </p>
          <button 
            onClick={handleStartARClick}
            style={{
              padding: '16px 36px',
              borderRadius: '30px',
              fontSize: '16px',
              fontWeight: '700',
              backgroundColor: '#3ddc97',
              color: '#06140f',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            START AR
          </button>
        </div>
      )}

      {isLive && (
        <div className="ar-overlay" style={{ pointerEvents: 'auto' }}>
          <div className="ar-topbar">
            <div className="ar-status live">Tracking live — walk naturally</div>
            <div className="ar-distance-pill">Total path: <b>{totalDistance.toFixed(1)} m</b></div>
          </div>
          
          <div className="ar-bottom">
            <div className="ar-pointlist">
              {points.map((pt, i) => (
                <div key={i} className="ar-point-row">
                  <span className="ar-name">{i + 1}. {pt.label}</span>
                  <span className="ar-meta">{i === 0 ? 'start' : pt.distFromPrev.toFixed(2) + ' m from prev'}</span>
                </div>
              ))}
            </div>
            
            <div className="ar-controls">
              <button className="btn btn-secondary" onClick={handleUndo}>Undo</button>
              <button className="btn btn-record" onClick={handleAddPoint} style={{backgroundColor: '#3ddc97', color: '#000'}}>
                + Add Point
              </button>
              <button className="btn btn-secondary" onClick={() => setShowMap(true)}>Finish</button>
            </div>
          </div>
        </div>
      )}

      {showMap && (
        <div className="map-overlay-container">
          <PathMap points={points} onClose={() => setShowMap(false)} />
          <div className="map-actions">
             <button className="btn btn-primary" onClick={handleSaveToCloud} disabled={isSaving}>
               {isSaving ? "Saving..." : "Save Path to Cloud"}
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
