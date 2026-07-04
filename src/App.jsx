import { useState } from 'react';
import CameraRecorder from './components/CameraRecorder';
import ARPathCapture from './components/ARPathCapture';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('video'); // 'video' or 'ar'

  return (
    <main className="app-main">
      <header className="app-header">
        <div className="logo">AR Vision</div>
        <p className="subtitle">Camera & AR Path Capture Prototype</p>
        
        <div className="tab-switcher">
          <button 
            className={`tab-btn ${activeTab === 'video' ? 'active' : ''}`}
            onClick={() => setActiveTab('video')}
          >
            Video Recorder
          </button>
          <button 
            className={`tab-btn ${activeTab === 'ar' ? 'active' : ''}`}
            onClick={() => setActiveTab('ar')}
          >
            AR Path Tracking
          </button>
        </div>
      </header>
      
      <section className="main-section">
        {activeTab === 'video' ? <CameraRecorder /> : <ARPathCapture />}
      </section>
    </main>
  );
}

export default App;
