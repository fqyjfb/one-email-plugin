import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import './styles/globals.css';
import ToolPanel from './ToolPanel';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error('Plugin error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-white text-black">
          <div className="max-w-md text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">插件加载失败</h2>
            <p className="text-gray-600 mb-4">遇到错误，请检查控制台获取详细信息。</p>
            <pre className="bg-gray-100 p-4 rounded-lg text-left text-sm text-gray-700 overflow-auto max-h-64">
              {this.state.error?.message}
            </pre>
            {this.state.errorInfo?.componentStack && (
              <pre className="bg-gray-100 p-4 rounded-lg text-left text-sm text-gray-700 overflow-auto max-h-64 mt-4">
                {this.state.errorInfo.componentStack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const PluginApp: React.FC = () => {
  return (
    <ErrorBoundary>
      <ToolPanel />
    </ErrorBoundary>
  );
};

function renderStandalone() {
  const root = document.getElementById('root');
  if (!root) {
    console.error('根元素未找到');
    return;
  }

  root.classList.add('one-email-plugin-root');

  ReactDOM.createRoot(root).render(<PluginApp />);
}

function registerPlugin(api: any) {
  const { registerTool, registerSidebarButton, openPluginWindow } = api;

  registerTool({
    id: 'plugin-one-email',
    name: '邮箱聚合',
    iconName: 'Mail',
    color: '#2563eb',
    textColor: '#ffffff',
    path: '/tools/plugin-one-email',
    component: PluginApp,
  });

  registerSidebarButton({
    id: 'plugin-one-email-btn',
    icon: 'Mail',
    label: '邮箱聚合',
    onClick: () => {
      openPluginWindow?.('plugin-one-email');
    },
  });
}

const pluginData = (window as any).__PLUGIN_DATA__;

if (pluginData) {
  renderStandalone();
}

if (typeof (window as any).__REGISTER_TOOLBOX_PLUGIN__ === 'function') {
  (window as any).__REGISTER_TOOLBOX_PLUGIN__(registerPlugin);
}
