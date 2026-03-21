import { useNavigate } from 'react-router-dom';
import './Home.css';

/**
 * RideApp Home - A modern, professional landing page.
 */
function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      {/* ── Navigation ── */}
      <nav className="home-nav">
        <div className="logo">RIDER.IO</div>
        <div className="nav-links">
          <button className="nav-btn login" onClick={() => navigate('/login')}>Log In</button>
          <button className="nav-btn signup" onClick={() => navigate('/signup')}>Sign Up</button>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <header className="home-hero">
        <div className="hero-text">
          <h1 className="hero-title">Your Journey,<br />Our Priority</h1>
          <p className="hero-subtitle">
            Experience the next generation of ride-sharing. Fast, reliable, and designed for your comfort. Whether you're commuting or road-tripping, we've got you covered.
          </p>
          <div className="hero-actions">
            <button className="hero-btn rider" onClick={() => navigate('/rider')}>
              <span>🚗</span> Get a Ride
            </button>
            <button className="hero-btn driver" onClick={() => navigate('/driver')}>
              <span>🤝</span> Drive with Us
            </button>
          </div>
        </div>

        <div className="hero-image-container">
          <div className="hero-circle" />
          <img 
            src="/assets/ride_app_hero_img.png" 
            alt="Ride Experience" 
            className="hero-card-img" 
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        </div>
      </header>

      {/* ── Features Section ── */}
      <section className="home-features">
        <div className="feature-card">
          <span className="feature-icon">🛡️</span>
          <h3 className="feature-title">Top-tier Safety</h3>
          <p className="feature-desc">All our drivers go through rigorous background checks and vehicle inspections.</p>
        </div>
        <div className="feature-card">
          <span className="feature-icon">⚡</span>
          <h3 className="feature-title">Lightning Fast</h3>
          <p className="feature-desc">Our smart matching algorithm ensures the closest driver reaches you in minutes.</p>
        </div>
        <div className="feature-card">
          <span className="feature-icon">💎</span>
          <h3 className="feature-title">Premium Support</h3>
          <p className="feature-desc">24/7 customer support ready to help you with any issues along the way.</p>
        </div>
      </section>
    </div>
  );
}

export default Home;