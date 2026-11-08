import React from "react";
import "./ErrorBoundary.css";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary caught an error]:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/dashboard";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="eb-container">
          <div className="eb-card animate-fadeUp">
            <div className="eb-icon">⚠️</div>
            <h2 className="eb-title">Something went wrong</h2>
            <p className="eb-msg">
              An unexpected error occurred while rendering this view. You can reload the page or return to the dashboard.
            </p>
            <div className="eb-actions">
              <button onClick={this.handleReload} className="eb-btn eb-btn--primary">
                Reload Page
              </button>
              <button onClick={this.handleGoHome} className="eb-btn eb-btn--secondary">
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

