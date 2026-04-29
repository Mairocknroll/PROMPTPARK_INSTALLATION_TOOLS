import React from 'react';

function Sidebar({ activeMenu, setActiveMenu }) {
    return (
        <div className="w-64 bg-[#090c10] border-r border-gray-800 p-5 flex flex-col shrink-0">
            <div className="mb-8">
                <h1 className="text-xl font-bold text-white tracking-tighter">PROMPTPARK</h1>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Installation Tools</p>
            </div>

            <div className="space-y-2 flex-1">
                <button
                    onClick={() => setActiveMenu('install_proxy')}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all ${activeMenu === 'install_proxy' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 font-bold' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}`}
                >
                    📦 Install Local Proxy
                </button>
                <button
                    onClick={() => setActiveMenu('hik_config')}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all ${activeMenu === 'hik_config' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 font-bold' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}`}
                >
                    📷 HIK LPR Config
                </button>
                <button
                    onClick={() => setActiveMenu('kiosk_deploy')}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all ${activeMenu === 'kiosk_deploy' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 font-bold' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}`}
                >
                    📱 Entrance Kiosk Installation
                </button>
                <button
                    onClick={() => setActiveMenu('exit_kiosk_deploy')}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all ${activeMenu === 'exit_kiosk_deploy' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 font-bold' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}`}
                >
                    📱 Exit Kiosk Installation
                </button>
                <button
                    onClick={() => setActiveMenu('integration_tools')}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all ${activeMenu === 'integration_tools' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 font-bold' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}`}
                >
                    🛠️ Integration Tools
                </button>
                <button
                    onClick={() => setActiveMenu('general_deploy')}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all ${activeMenu === 'general_deploy' ? 'bg-orange-600/10 text-orange-400 border border-orange-500/20 font-bold' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}`}
                >
                    🚀 General App Installer
                </button>
            </div>
            <div className="text-[10px] text-gray-600 text-center pb-2 pt-4 border-t border-gray-800">v1.0.0</div>
        </div>
    );
}

export default Sidebar;
