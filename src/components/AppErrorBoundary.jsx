import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', error, info);
  }

  handleReload = () => {
    sessionStorage.removeItem('__rw_reload_guard');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-6">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Algo deu errado.
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Tente recarregar a página. Se o problema persistir, entre em contato com o suporte.
            </p>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg bg-rose-500 text-white hover:bg-rose-600"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
