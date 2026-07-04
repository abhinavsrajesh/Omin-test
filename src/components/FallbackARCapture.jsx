import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { savePath } from '../services/pathService';
import PathMap from './PathMap';

const POI_LABELS = ['Entrance', 'Junction', 'CT Scan', 'Lab', 'Pharmacy', 'Ward', 'Lift', 'Stairs', 'Reception'];

export default function FallbackARCapture(props) {
  const [points, setPoints] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [stepCount, setStepCount] = useState(0);

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  
  // Pedometer tracking
  const currentPoseRef = useRef({ x: 0, y: 0, z: 0 });
  const lastStepTimeRef = useRef(0);
  const STRIDE_LENGTH = 0.75; // meters per step

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  const stopSession = () => {
    if (rendererRef.current) {
      rendererRef.current.setAnimationLoop(null);
      if (document.body.contains(rendererRef.current.domElement)) {
        document.body.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current.dispose();
      rendererRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    window.removeEventListener('devicemotion', handleMotion);
  };

  const requestPermissions = async () => {
    try {
      // 1. Request Camera
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // 2. Request Device Orientation (iOS 13+ requirement, auto-resolves on Android)
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') {
          alert('Orientation permission needed for tracking.');
          return;
        }
      }

      setPermissionGranted(true);
      startSession();
    } catch (err) {
      console.error(err);
      alert('Failed to get camera or sensors. Please grant permissions.');
    }
  };

  const handleMotion = (event) => {
    if (!event.accelerationIncludingGravity) return;
    
    // Simple pedometer algorithm: Peak detection on acceleration magnitude
    const acc = event.accelerationIncludingGravity;
    const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    
    // Standard gravity is ~9.8. A step usually peaks above 11.5 to 12.
    const threshold = 11.5; 
    const now = Date.now();

    if (magnitude > threshold && (now - lastStepTimeRef.current) > 350) {
      // Step detected! (Debounce 350ms between steps)
      lastStepTimeRef.current = now;
      setStepCount(prev => prev + 1);
      
      // Move camera forward in the direction it's currently facing
      if (cameraRef.current) {
        const direction = new THREE.Vector3();
        cameraRef.current.getWorldDirection(direction);
        // We only care about horizontal movement (x, z)
        direction.y = 0;
        direction.normalize();
        
        currentPoseRef.current.x += direction.x * STRIDE_LENGTH;
        currentPoseRef.current.z += direction.z * STRIDE_LENGTH;
        
        cameraRef.current.position.set(currentPoseRef.current.x, currentPoseRef.current.y, currentPoseRef.current.z);
      }
    }
  };

  const startSession = () => {
    // Init Three.js
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
    camera.position.set(0, 1.6, 0); // Average eye height
    cameraRef.current = camera;
    currentPoseRef.current = { x: 0, y: 1.6, z: 0 };

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Transparent to show video behind
    rendererRef.current = renderer;

    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.zIndex = '1';
    renderer.domElement.style.pointerEvents = 'none'; // Let clicks pass to UI
    document.body.appendChild(renderer.domElement);

    const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    scene.add(light);

    // Init custom Orientation listener
    const handleOrientation = (event) => {
      if (!cameraRef.current) return;
      const alpha = event.alpha ? THREE.MathUtils.degToRad(event.alpha) : 0; // Z-axis
      const beta = event.beta ? THREE.MathUtils.degToRad(event.beta) : 0; // X-axis
      const gamma = event.gamma ? THREE.MathUtils.degToRad(event.gamma) : 0; // Y-axis

      // A simplified rotation mapping for portrait mode
      const euler = new THREE.Euler(beta, alpha, -gamma, 'YXZ');
      cameraRef.current.quaternion.setFromEuler(euler);
    };
    window.addEventListener('deviceorientation', handleOrientation);

    // Listen for steps
    window.addEventListener('devicemotion', handleMotion);

    // Animation Loop
    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera);
    });

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    setIsLive(true);
    if (props.onLiveStateChange) props.onLiveStateChange(true);
    document.body.classList.add('ar-live-mode');
  };

  const dist3D = (a, b) => {
    return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2); // Only horizontal distance
  };

  const addMarkerMesh = (x, y, z, color = 0x3ddc97) => {
    if (!sceneRef.current) return;
    const geo = new THREE.SphereGeometry(0.2, 16, 16); // Slightly bigger for visibility
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y - 0.5, z); // Place slightly below eye level
    sceneRef.current.add(mesh);
    return mesh;
  };

  const handleAddPoint = () => {
    setPoints(prevPoints => {
      const label = POI_LABELS[Math.min(prevPoints.length, POI_LABELS.length - 1)] + 
                    (prevPoints.length >= POI_LABELS.length ? ` ${prevPoints.length}` : '');
      
      let distFromPrev = 0;
      if (prevPoints.length > 0) {
        distFromPrev = dist3D(prevPoints[prevPoints.length - 1], currentPoseRef.current);
      }
      
      const newPoint = { ...currentPoseRef.current, label, distFromPrev };
      
      addMarkerMesh(newPoint.x, newPoint.y, newPoint.z, prevPoints.length === 0 ? 0xe2574c : 0x3ddc97);
      
      if (navigator.vibrate) navigator.vibrate(30);
      return [...prevPoints, newPoint];
    });
  };

  const handleUndo = () => {
    if (points.length === 0) return;
    setPoints(prev => {
      const newPoints = [...prev];
      newPoints.pop();
      return newPoints;
    });
  };

  const handleSaveToCloud = async () => {
    if (points.length === 0) return;
    try {
      setIsSaving(true);
      await savePath("Sensor Walkthrough " + new Date().toLocaleTimeString(), points);
      alert("Path successfully saved to Firestore!");
      setShowMap(false);
      stopSession();
      setIsLive(false);
      if (props.onLiveStateChange) props.onLiveStateChange(false);
      document.body.classList.remove('ar-live-mode');
    } catch (err) {
      console.error(err);
      alert("Failed to save path. Check console.");
    } finally {
      setIsSaving(false);
    }
  };

  const totalDistance = points.reduce((acc, p) => acc + (p.distFromPrev || 0), 0);

  return (
    <div className="ar-container" ref={containerRef}>
      
      {/* Fallback Camera Background */}
      {isLive && (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            objectFit: 'cover',
            zIndex: 0
          }}
        />
      )}

      {!isLive && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '1rem' }}>Sensor-Fusion Tracker</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Uses your phone's camera and pedometer to track distance without WebXR. Hold phone upright and walk naturally.
          </p>
          <button 
            onClick={requestPermissions}
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
            START SENSOR TRACKING
          </button>
        </div>
      )}

      {isLive && (
        <div className="ar-overlay" style={{ pointerEvents: 'auto', zIndex: 10 }}>
          <div className="ar-topbar">
            <div className="ar-status live">Tracking steps — hold upright</div>
            <div className="ar-distance-pill">Steps: <b>{stepCount}</b> | Total path: <b>{totalDistance.toFixed(1)} m</b></div>
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
        <div className="map-overlay-container" style={{ zIndex: 30 }}>
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
