import { useState, useEffect } from 'react';
import FallbackARCapture from './components/FallbackARCapture';
import './index.css';

function App() {
  const [isARLive, setIsARLive] = useState(false);

  // We pass a callback to ARPathCapture so it can tell App when AR starts/stops
  return (
    <main className="app-main" style={{ display: isARLive ? 'none' : 'flex' }}>
      <header className="app-header">
        <div className="logo">AR Vision</div>
        <p className="subtitle">AR Path Capture Prototype</p>
      </header>
      
      <section className="main-section">
        <FallbackARCapture onLiveStateChange={setIsARLive} />
      </section>
    </main>
  );
}

export default App;
