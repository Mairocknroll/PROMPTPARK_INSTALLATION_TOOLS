import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ProxyInstall from './components/ProxyInstall';
import HikConfig from './components/HikConfig';
import EntranceKioskDeploy from './components/EntranceKioskDeploy';
import ExitKioskDeploy from './components/ExitKioskDeploy';
import IntegrationTools from './components/IntegrationTools';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    render() {
        if (this.state.error) {
            return (
                <div className="min-h-screen bg-[#0d1117] text-red-300 p-6 font-mono">
                    <h1 className="text-xl font-bold text-white mb-3">Application Error</h1>
                    <pre className="bg-black/50 border border-red-900 rounded p-4 text-xs whitespace-pre-wrap">
                        {String(this.state.error?.message || this.state.error)}
                    </pre>
                </div>
            );
        }
        return this.props.children;
    }
}

function App() {
    const [activeMenu, setActiveMenu] = useState('install_proxy');

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-[#0d1117] text-gray-300 flex font-mono h-screen overflow-hidden">
                <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
                <div className="flex-1 p-8 overflow-y-auto">
                    <div className="max-w-6xl mx-auto">
                        {activeMenu === 'install_proxy' && <ProxyInstall />}
                        {activeMenu === 'hik_config' && <HikConfig />}
                        {activeMenu === 'kiosk_deploy' && <EntranceKioskDeploy />}
                        {activeMenu === 'exit_kiosk_deploy' && <ExitKioskDeploy />}
                        {activeMenu === 'integration_tools' && <IntegrationTools />}
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    );
}

export default App;
