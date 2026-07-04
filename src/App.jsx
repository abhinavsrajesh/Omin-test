import ARPathCapture from './components/ARPathCapture';
import './index.css';

function App() {
  return (
    <main className="app-main">
      <header className="app-header">
        <div className="logo">AR Vision</div>
        <p className="subtitle">AR Path Capture Prototype</p>
      </header>
      
      <section className="main-section">
        <ARPathCapture />
      </section>
    </main>
  );
}

export default App;
