import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { savePath } from '../services/pathService';
import PathMap from './PathMap';

const POI_LABELS = ['Entrance', 'Junction', 'CT Scan', 'Lab', 'Pharmacy', 'Ward', 'Lift', 'Stairs', 'Reception'];

export default function ARPathCapture() {
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
      if (supported) {
        init3D();
      }
    });

    return () => {
      // Cleanup
      if (rendererRef.current) {
        rendererRef.current.setAnimationLoop(null);
        if (containerRef.current && containerRef.current.contains(rendererRef.current.domElement)) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, []);

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

    if (containerRef.current) {
      containerRef.current.appendChild(renderer.domElement);
      // Ensure canvas spans the full screen behind the UI
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.inset = '0';
      renderer.domElement.style.zIndex = '0';
    }

    const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    scene.add(light);

    // Create AR Button exactly like OMNINAV.html
    const button = ARButton.createButton(renderer, { requiredFeatures: ['local-floor'] });
    button.id = 'ar-start-button'; // To style or hide it if needed
    button.style.position = 'absolute';
    button.style.top = '50%';
    button.style.left = '50%';
    button.style.transform = 'translate(-50%, -50%)';
    button.style.padding = '16px 36px';
    button.style.borderRadius = '30px';
    button.style.fontSize = '16px';
    button.style.fontWeight = '700';
    button.style.backgroundColor = '#3ddc97';
    button.style.color = '#06140f';
    button.style.border = 'none';
    button.style.cursor = 'pointer';
    button.style.zIndex = '20';
    
    // Replace default text if desired, but ARButton injects its own. We just style it.
    if (containerRef.current) {
      containerRef.current.appendChild(button);
    }

    renderer.xr.addEventListener('sessionstart', () => {
      xrSessionRef.current = renderer.xr.getSession();
      setIsLive(true);
      button.style.display = 'none'; // Hide button after starting
      document.body.classList.add('ar-live-mode');
    });

    renderer.xr.addEventListener('sessionend', () => {
      setIsLive(false);
      button.style.display = 'block';
      document.body.classList.remove('ar-live-mode');
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
      {/* The 3D canvas will be injected here automatically by Three.js */}

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
