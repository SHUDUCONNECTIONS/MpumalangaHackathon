import { Component } from 'react';

// Stops one rendering bug from blanking the whole app.
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" style={{ padding: 32, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <h2>Something went wrong</h2>
        <p>The app hit an unexpected problem. Your messages and submissions are safe.</p>
        <button onClick={() => location.reload()} style={{ padding: '12px 20px', borderRadius: 12, border: 0, background: '#0b4a3c', color: '#fff', fontWeight: 600 }}>
          Reload the app
        </button>
      </div>
    );
  }
}
