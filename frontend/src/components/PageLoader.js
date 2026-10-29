import React from 'react';
import './PageLoader.css';

/**
 * PageLoader
 * Full-screen loading spinner shown while a lazy-loaded route chunk is
 * being fetched. Used as the <Suspense fallback> in App.js.
 */
function PageLoader() {
  return (
    <div className="page-loader" aria-label="Loading page…" role="status">
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="page-loader__glow" />
        <div className="page-loader__ring" />
      </div>
      <span className="page-loader__label">Loading…</span>
    </div>
  );
}

export default PageLoader;
