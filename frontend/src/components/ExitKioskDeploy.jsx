import React, { useState, useEffect } from 'react';
import { BrowseAPKFile, DeployExitKioskAPK } from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';

function ExitKioskDeploy() {
    const [exitKioskApkPath, setExitKioskApkPath] = useState('');
    const [exitKioskDevices, setExitKioskDevices] = useState([]);
    const [showExitKioskModal, setShowExitKioskModal] = useState(false);
    const [newExitKioskDev, setNewExitKioskDev] = useState({ ip: '', deviceName: '', gateNo: '1', plcIp: '' });
    const [exitKioskGlobalConfig, setExitKioskGlobalConfig] = useState({
        parkingCode: 'la26010038',
        projectCode: 'LA26010038',
        paymentTicket: 'https://payment.jparkdev.co',
        serverUrl: 'https://api-pms.jparkdev.co',
        localServerUrl: '',
        vehicleMode: 'Car',
        apiMode: 'V2',
        zoningMode: 'NORMAL',
        zoningCode: '',
        zoningGateNo: '1',
        nextZoningCode: '',
        nextZoningGateNo: '',
        isCash: false,
        isQR: true,
        ticketMode: 'default'
    });
    const [exitKioskStatus, setExitKioskStatus] = useState('');
    const [isExitKioskDeploying, setIsExitKioskDeploying] = useState(false);
    const [exitKioskProgress, setExitKioskProgress] = useState(0);

    useEffect(() => {
        EventsOn("exit-kiosk-progress", (data) => {
            setExitKioskProgress(data.progress);
            setExitKioskStatus(prev => prev + '\n' + data.message);
        });
        return () => {
            EventsOff("exit-kiosk-progress");
        };
    }, []);

    const handleBrowseExitAPK = async () => {
        const path = await BrowseAPKFile();
        if (path) setExitKioskApkPath(path);
    };

    const handleAddExitKioskDevice = () => {
        setExitKioskDevices([...exitKioskDevices, { ...newExitKioskDev, id: Date.now() }]);
        setShowExitKioskModal(false);
        setNewExitKioskDev({ ip: '', deviceName: '', gateNo: String(parseInt(newExitKioskDev.gateNo) + 1), plcIp: '' });
    };

    const handleDeployExitKiosk = async () => {
        if (exitKioskDevices.length === 0) {
            alert('Please add at least one device.');
            return;
        }
        setIsExitKioskDeploying(true);
        setExitKioskProgress(0);
        setExitKioskStatus('🚀 Starting Exit Kiosk deployment...');
        try {
            await DeployExitKioskAPK({
                apkPath: exitKioskApkPath,
                devices: exitKioskDevices.map(d => ({ ip: d.ip, deviceName: d.deviceName, gateNo: d.gateNo, plcIp: d.plcIp })),
                ...exitKioskGlobalConfig
            });
        } catch (e) {
            setExitKioskStatus(prev => prev + '\n❌ Error: ' + e);
        }
        setIsExitKioskDeploying(false);
    };

    return (
        <>
            <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Exit Kiosk Installation</h2>
                    <p className="text-xs text-gray-500 mt-1">Install APK & push SharedPreferences config to multiple Android Exit Kiosk devices via ADB</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setShowExitKioskModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm transition-all">+ Add Device</button>
                    <button
                        onClick={handleDeployExitKiosk}
                        disabled={isExitKioskDeploying || exitKioskDevices.length === 0}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${isExitKioskDeploying || exitKioskDevices.length === 0 ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                    >
                        {isExitKioskDeploying ? 'Deploying...' : 'Deploy to All Devices'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6 overflow-y-auto" style={{ maxHeight: '75vh' }}>
                    {/* APK Selection */}
                    <div className="bg-[#161b22] border border-gray-800 rounded-lg p-5">
                        <h2 className="text-blue-400 text-xs font-bold uppercase mb-4 tracking-tighter">APK File</h2>
                        <div className="flex gap-2">
                            <input
                                className="flex-1 bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-400 truncate"
                                value={exitKioskApkPath || 'No APK selected (config-only mode)'}
                                readOnly
                            />
                            <button onClick={handleBrowseExitAPK} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-xs">Browse</button>
                        </div>
                    </div>

                    {/* Global Config */}
                    <div className="bg-[#161b22] border border-gray-800 rounded-lg p-5">
                        <h2 className="text-blue-400 text-xs font-bold uppercase mb-4 tracking-tighter">Global Config (SharedPreferences)</h2>
                        <div className="space-y-3">
                            {[
                                ['parkingCode', 'Parking Code'],
                                ['projectCode', 'Project Code'],
                                ['paymentTicket', 'Payment Ticket URL'],
                                ['serverUrl', 'Server URL'],
                                ['localServerUrl', 'Local Server URL'],
                            ].map(([key, label]) => (
                                <div key={key}>
                                    <label className="text-[10px] text-gray-500 block mb-1">{label}</label>
                                    <input
                                        className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-xs"
                                        value={exitKioskGlobalConfig[key]}
                                        onChange={e => setExitKioskGlobalConfig({ ...exitKioskGlobalConfig, [key]: e.target.value })}
                                    />
                                </div>
                            ))}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] text-gray-500 block mb-1">Vehicle Mode</label>
                                    <select className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-xs" value={exitKioskGlobalConfig.vehicleMode} onChange={e => setExitKioskGlobalConfig({ ...exitKioskGlobalConfig, vehicleMode: e.target.value })}>
                                        <option value="Car">Car</option>
                                        <option value="Motorcycle">Motorcycle</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 block mb-1">API Mode</label>
                                    <select className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-xs" value={exitKioskGlobalConfig.apiMode} onChange={e => setExitKioskGlobalConfig({ ...exitKioskGlobalConfig, apiMode: e.target.value })}>
                                        <option value="V1">V1</option>
                                        <option value="V2">V2</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] text-gray-500 block mb-1">Zoning Mode</label>
                                    <select className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-xs" value={exitKioskGlobalConfig.zoningMode} onChange={e => setExitKioskGlobalConfig({ ...exitKioskGlobalConfig, zoningMode: e.target.value })}>
                                        <option value="NORMAL">NORMAL</option>
                                        <option value="MAIN">MAIN</option>
                                        <option value="ZONING">ZONING</option>
                                        <option value="RESERVE">RESERVE</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 block mb-1">Ticket Mode</label>
                                    <select className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-xs" value={exitKioskGlobalConfig.ticketMode} onChange={e => setExitKioskGlobalConfig({ ...exitKioskGlobalConfig, ticketMode: e.target.value })}>
                                        <option value="default">Default</option>
                                        <option value="chula">Chula</option>
                                        <option value="government">Government</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] text-gray-500 block mb-1">Zoning Code</label>
                                    <input className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-xs" value={exitKioskGlobalConfig.zoningCode} onChange={e => setExitKioskGlobalConfig({ ...exitKioskGlobalConfig, zoningCode: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 block mb-1">Next Zoning Code</label>
                                    <input className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-xs" value={exitKioskGlobalConfig.nextZoningCode} onChange={e => setExitKioskGlobalConfig({ ...exitKioskGlobalConfig, nextZoningCode: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 block mb-1">Next Zoning Gate No</label>
                                <input className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-xs" value={exitKioskGlobalConfig.nextZoningGateNo} onChange={e => setExitKioskGlobalConfig({ ...exitKioskGlobalConfig, nextZoningGateNo: e.target.value })} />
                            </div>
                            <div className="flex gap-4 mt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={exitKioskGlobalConfig.isCash} onChange={e => setExitKioskGlobalConfig({ ...exitKioskGlobalConfig, isCash: e.target.checked })} className="w-4 h-4 accent-blue-500" />
                                    <span className="text-[10px] text-gray-300">Cash Payment</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={exitKioskGlobalConfig.isQR} onChange={e => setExitKioskGlobalConfig({ ...exitKioskGlobalConfig, isQR: e.target.checked })} className="w-4 h-4 accent-blue-500" />
                                    <span className="text-[10px] text-gray-300">QR Payment</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Device List */}
                    <div className="space-y-3">
                        {exitKioskDevices.length === 0 && (
                            <div className="text-center text-gray-600 py-8 text-sm">No devices added yet. Click "+ Add Device".</div>
                        )}
                        {exitKioskDevices.map(dev => (
                            <div key={dev.id} className="bg-[#161b22] border border-gray-700 rounded-lg p-4 relative group">
                                <button onClick={() => setExitKioskDevices(exitKioskDevices.filter(d => d.id !== dev.id))} className="absolute top-2 right-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs">Delete</button>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-900 text-purple-300">Gate {dev.gateNo}</span>
                                </div>
                                <div className="text-xs space-y-1">
                                    <p><span className="text-gray-500">IP:</span> {dev.ip}</p>
                                    <p><span className="text-gray-500">Name:</span> {dev.deviceName}</p>
                                    <p><span className="text-gray-500">PLC:</span> {dev.plcIp}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Status Log */}
                <div className="lg:col-span-2">
                    <div className="bg-[#090c10] border border-gray-800 rounded-lg p-5 h-[70vh] flex flex-col">
                        <h2 className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">Deployment Log</h2>
                        {isExitKioskDeploying && (
                            <div className="mb-4">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-blue-400">Progress</span>
                                    <span className="text-blue-400">{exitKioskProgress}%</span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-2.5">
                                    <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${exitKioskProgress}%` }}></div>
                                </div>
                            </div>
                        )}
                        <pre className="text-[11px] text-green-400 font-mono whitespace-pre-wrap leading-5 flex-1 overflow-y-auto bg-black/50 p-3 rounded border border-gray-800/50">
                            {exitKioskStatus || 'Waiting to deploy...'}
                        </pre>
                    </div>
                </div>
            </div>

            {/* Modal - Add Exit Kiosk Device */}
            {showExitKioskModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-[#161b22] border border-gray-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-6">Add Exit Kiosk Device</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-500">Device IP (ADB over WiFi)</label>
                                <input className="w-full bg-[#0d1117] border border-gray-800 rounded p-2 mt-1 text-sm" placeholder="192.168.1.100" value={newExitKioskDev.ip} onChange={e => setNewExitKioskDev({ ...newExitKioskDev, ip: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Device Name</label>
                                <input className="w-full bg-[#0d1117] border border-gray-800 rounded p-2 mt-1 text-sm" placeholder="asus-kiosk-sixx-out-01" value={newExitKioskDev.deviceName} onChange={e => setNewExitKioskDev({ ...newExitKioskDev, deviceName: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Gate No</label>
                                <input className="w-full bg-[#0d1117] border border-gray-800 rounded p-2 mt-1 text-sm" value={newExitKioskDev.gateNo} onChange={e => setNewExitKioskDev({ ...newExitKioskDev, gateNo: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">PLC/Modbus IP</label>
                                <input className="w-full bg-[#0d1117] border border-gray-800 rounded p-2 mt-1 text-sm" placeholder="10.10.11.10" value={newExitKioskDev.plcIp} onChange={e => setNewExitKioskDev({ ...newExitKioskDev, plcIp: e.target.value })} />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setShowExitKioskModal(false)} className="flex-1 text-gray-400 hover:text-white text-sm">Cancel</button>
                                <button onClick={handleAddExitKioskDevice} className="flex-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-2 rounded-lg text-sm font-bold transition-colors">Add Device</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default ExitKioskDeploy;
