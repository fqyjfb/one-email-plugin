import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
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

function injectTailwindVariables() {
  const style = document.createElement('style');
  style.textContent = `
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --accent: 240 4.8% 95.9%;
  --accent-foreground: 240 5.9% 10%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 240 10% 3.9%;
  --radius: 0.5rem;
}

.dark {
  --background: 224 14% 10%;
  --foreground: 210 40% 98%;
  --card: 224 14% 12%;
  --card-foreground: 210 40% 98%;
  --popover: 224 14% 12%;
  --popover-foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --primary-foreground: 222 47.4% 11.2%;
  --secondary: 224 10% 18%;
  --secondary-foreground: 210 40% 98%;
  --muted: 224 10% 18%;
  --muted-foreground: 215 20.2% 65.1%;
  --accent: 224 10% 18%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;
  --border: 224 10% 22%;
  --input: 224 10% 22%;
  --ring: 224 14% 40%;
}

.one-email-plugin-root {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.one-email-plugin-root * {
  -webkit-tap-highlight-color: transparent;
}

.one-email-plugin-root ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.one-email-plugin-root ::-webkit-scrollbar-track {
  background: transparent;
}

.one-email-plugin-root ::-webkit-scrollbar-thumb {
  background: hsl(var(--border));
  border-radius: 4px;
}

.one-email-plugin-root ::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground));
}
`;
  document.head.appendChild(style);
}

function renderStandalone() {
  injectTailwindVariables();

  const root = document.getElementById('root');
  if (!root) {
    console.error('根元素未找到');
    return;
  }

  root.classList.add('one-email-plugin-root');

  ReactDOM.createRoot(root).render(<PluginApp />);
}

function registerPlugin(api: any) {
  injectTailwindVariables();

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
