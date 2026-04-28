import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ProxyInstall from './components/ProxyInstall';
import HikConfig from './components/HikConfig';
import EntranceKioskDeploy from './components/EntranceKioskDeploy';
import ExitKioskDeploy from './components/ExitKioskDeploy';
import IntegrationTools from './components/IntegrationTools';

function App() {
    const [activeMenu, setActiveMenu] = useState('install_proxy');

    return (
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
    );
}

export default App;