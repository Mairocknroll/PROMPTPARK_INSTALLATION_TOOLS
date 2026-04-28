import React, { useState, useEffect } from 'react';
import { BrowseAPKFile, DeployKioskAPK, ReadEntranceKioskConfig, UpdateEntranceKioskConfig } from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';

function EntranceKioskDeploy() {
    const [activeTab, setActiveTab] = useState('install');

    // --- Install Tab State ---
    const [kioskApkPath, setKioskApkPath] = useState('');
    const [kioskDevices, setKioskDevices] = useState([]);
    const [showKioskModal, setShowKioskModal] = useState(false);
    const [newKioskDev, setNewKioskDev] = useState({ ip: '', deviceName: '', gateNo: '1', plcIp: '' });
    const [kioskGlobalConfig, setKioskGlobalConfig] = useState({
        parkingCode: 'la26010038',
        paymentTicket: 'https://payment.jparkdev.co',
        serverUrl: 'https://api-pms.jparkdev.co',
        localServerUrl: '',
        vehicleMode: 'Car',
        isSpecialEntrance: false,
        paymentApiVersion: 'API Promptpark',
        apiMode: 'V2',
        screenTimeoutSec: 10,
        zoningMode: 'NORMAL',
        zoningCode: '',
        zoningGateNo: '1'
    });

    // --- Read/Edit Tab State ---
    const [readIps, setReadIps] = useState([]);
    const [newReadIp, setNewReadIp] = useState('');
    const [readConfigs, setReadConfigs] = useState({});

    // Shared Status State
    const [kioskStatus, setKioskStatus] = useState('');
    const [isKioskDeploying, setIsKioskDeploying] = useState(false);
    const [kioskProgress, setKioskProgress] = useState(0);

    useEffect(() => {
        EventsOn("kiosk-progress", (data) => {
            setKioskProgress(data.progress);
            setKioskStatus(prev => prev + '\n' + data.message);
        });
        return () => {
            EventsOff("kiosk-progress");
        };
    }, []);

    // --- Methods ---
    const handleBrowseAPK = async () => {
        const path = await BrowseAPKFile();
        if (path) setKioskApkPath(path);
    };

    const handleAddKioskDevice = () => {
        setKioskDevices([...kioskDevices, { ...newKioskDev, id: Date.now() }]);
        setShowKioskModal(false);
        setNewKioskDev({ ip: '', deviceName: '', gateNo: String(parseInt(newKioskDev.gateNo) + 1), plcIp: '' });
    };

    const handleDeployKiosk = async () => {
        if (kioskDevices.length === 0) {
            alert('Please add at least one device.');
            return;
        }
        if (!kioskGlobalConfig.localServerUrl) {
            alert('Local Server URL is required!');
            return;
        }
        setIsKioskDeploying(true);
        setKioskProgress(0);
        setKioskStatus('🚀 Starting Kiosk deployment...');
        try {
            await DeployKioskAPK({
                apkPath: kioskApkPath,
                devices: kioskDevices.map(d => ({ ip: d.ip, deviceName: d.deviceName, gateNo: d.gateNo, plcIp: d.plcIp })),
                ...kioskGlobalConfig,
                screenTimeoutSec: parseInt(kioskGlobalConfig.screenTimeoutSec) || 10
            });
        } catch (e) {
            setKioskStatus(prev => prev + '\n❌ Error: ' + e);
        }
        setIsKioskDeploying(false);
    };

    const handleAddReadIp = () => {
        if (newReadIp && !readIps.includes(newReadIp)) {
            setReadIps([...readIps, newReadIp]);
            setNewReadIp('');
        }
    };

    const handleRemoveReadIp = (ip) => {
        setReadIps(readIps.filter(i => i !== ip));
        const updatedConfigs = { ...readConfigs };
        delete updatedConfigs[ip];
        setReadConfigs(updatedConfigs);
    };

    const handleReadAll = async () => {
        if (readIps.length === 0) return;
        setIsKioskDeploying(true);
        setKioskStatus('📡 Reading configs from devices...');
        let updatedConfigs = { ...readConfigs };

        for (const ip of readIps) {
            setKioskStatus(prev => prev + `\nReading from ${ip}...`);
            try {
                const configMap = await ReadEntranceKioskConfig(ip);
                if (!configMap || Object.keys(configMap).length === 0) {
                    setKioskStatus(prev => prev + `\n❌ No configuration data found for ${ip}.`);
                } else {
                    updatedConfigs[ip] = {
                        ip: ip,
                        deviceName: configMap.deviceNameConfig || '',
                        gateNo: configMap.gateConfig || '',
                        plcIp: configMap.plcIpConfig || '',
                        parkingCode: configMap.parkingCodeConfig || '',
                        paymentTicket: configMap.paymentTicket || '',
                        serverUrl: configMap.serverConfig || '',
                        localServerUrl: configMap.localServerConfig || '',
                        vehicleMode: configMap.vehicleMode || 'Car',
                        isSpecialEntrance: configMap.isSpecialEntrance === 'true',
                        paymentApiVersion: configMap.paymentApiVersionConfig || 'API Promptpark',
                        apiMode: configMap.apiMode || 'V2',
                        screenTimeoutSec: configMap.setTime ? parseInt(configMap.setTime) / 1000 : 10,
                        zoningMode: configMap.zoningMode || 'NORMAL',
                        zoningCode: configMap.zoningCode || '',
                        zoningGateNo: configMap.zoningGateNo || '1'
                    };
                    setKioskStatus(prev => prev + `\n✅ Read success for ${ip}`);
                }
            } catch (e) {
                setKioskStatus(prev => prev + `\n❌ Failed to read ${ip}: ${e}`);
            }
        }
        setReadConfigs(updatedConfigs);
        setIsKioskDeploying(false);
    };

    const handleConfigChange = (ip, field, value) => {
        setReadConfigs({
            ...readConfigs,
            [ip]: { ...readConfigs[ip], [field]: value }
        });
    };

    const handleSaveAll = async () => {
        const configsToSave = Object.values(readConfigs);
        if (configsToSave.length === 0) return;
        
        let hasError = false;
        configsToSave.forEach(c => {
            if (!c.localServerUrl) hasError = true;
        });
        if (hasError) {
            alert('Local Server URL is required for all devices!');
            return;
        }

        setIsKioskDeploying(true);
        setKioskProgress(0);
        setKioskStatus('🚀 Saving configurations to devices...');
        try {
            await UpdateEntranceKioskConfig(configsToSave);
        } catch (e) {
            setKioskStatus(prev => prev + '\n❌ Error: ' + e);
        }
        setIsKioskDeploying(false);
    };

    return (
        <>
            <div className="flex justify-between items-center mb-6 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Entrance Kiosk Installation</h2>
                    <p className="text-xs text-gray-500 mt-1">Manage APK installation and SharedPreferences configurations via ADB</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800 mb-6 gap-6">
                <button 
                    onClick={() => setActiveTab('install')}
                    className={`pb-2 text-sm font-bold transition-all ${activeTab === 'install' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    New Install
                </button>
                <button 
                    onClick={() => setActiveTab('read')}
                    className={`pb-2 text-sm font-bold transition-all ${activeTab === 'read' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Read & Edit Config
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column Content Based on Tab */}
                <div className="lg:col-span-1 space-y-6 overflow-y-auto" style={{ maxHeight: '75vh' }}>
                    
                    {activeTab === 'install' && (
                        <>
                            <div className="flex justify-end gap-3 mb-2">
                                <button onClick={() => setShowKioskModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md text-xs transition-all">+ Add Device</button>
                                <button
                                    onClick={handleDeployKiosk}
                                    disabled={isKioskDeploying || kioskDevices.length === 0}
                                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${isKioskDeploying || kioskDevices.length === 0 ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                                >
                                    Deploy All
                                </button>
                            </div>

                            {/* APK Selection */}
                            <div className="bg-[#161b22] border border-gray-800 rounded-lg p-5">
                                <h2 className="text-blue-400 text-xs font-bold uppercase mb-4 tracking-tighter">APK File</h2>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-400 truncate"
                                        value={kioskApkPath || 'No APK selected (config-only mode)'}
                                        readOnly
                                    />
                                    <button onClick={handleBrowseAPK} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-xs">Browse</button>
                                </div>
                            </div>

                            {/* Global Config */}
                            <div className="bg-[#161b22] border border-gray-800 rounded-lg p-5">
                                <h2 className="text-blue-400 text-xs font-bold uppercase mb-4 tracking-tighter">Global Config (SharedPreferences)</h2>
                                <div className="space-y-3">
                                    {[
                                        ['parkingCode', 'Parking Code'],
                                        ['paymentTicket', 'Payment Ticket URL'],
                                        ['serverUrl', 'Server URL'],
                                        ['localServerUrl', 'Local Server URL'],
                                    ].map(([key, label]) => (
                                        <div key={key}>
                                            <label className="text-[10px] text-gray-500 block mb-1">
                                                {label}
                                                {key === 'localServerUrl' && <span className="text-red-500 ml-1">*</span>}
                                            </label>
                                            <input
                                                className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-xs"
                                                value={kioskGlobalConfig[key]}
                                                onChange={e => setKioskGlobalConfig({ ...kioskGlobalConfig, [key]: e.target.value })}
                                            />
                                        </div>
                                    ))}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] text-gray-500 block mb-1">Vehicle Mode</label>
                                            <select className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-xs" value={kioskGlobalConfig.vehicleMode} onChange={e => setKioskGlobalConfig({ ...kioskGlobalConfig, vehicleMode: e.target.value })}>
                                                <option value="Car">Car</option>
                                                <option value="Motorcycle">Motorcycle</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500 block mb-1">Payment API</label>
                                            <select className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-xs" value={kioskGlobalConfig.paymentApiVersion} onChange={e => setKioskGlobalConfig({ ...kioskGlobalConfig, paymentApiVersion: e.target.value })}>
                                                <option value="API Promptpark">API Promptpark</option>
                                                <option value="API External">API External</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="text-[10px] text-gray-500 block mb-1">API Mode</label>
                                            <select className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-xs" value={kioskGlobalConfig.apiMode} onChange={e => setKioskGlobalConfig({ ...kioskGlobalConfig, apiMode: e.target.value })}>
                                                <option value="V1">V1</option>
                                                <option value="V2">V2</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500 block mb-1">Screen Timeout</label>
                                            <input type="number" className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-xs" value={kioskGlobalConfig.screenTimeoutSec} onChange={e => setKioskGlobalConfig({ ...kioskGlobalConfig, screenTimeoutSec: e.target.value })} />
                                        </div>
                                        <div className="flex items-end pb-1">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={kioskGlobalConfig.isSpecialEntrance} onChange={e => setKioskGlobalConfig({ ...kioskGlobalConfig, isSpecialEntrance: e.target.checked })} className="w-4 h-4 accent-blue-500" />
                                                <span className="text-[10px] text-gray-300">Special Ent.</span>
                                            </label>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] text-gray-500 block mb-1">Zoning Mode</label>
                                            <select className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-xs" value={kioskGlobalConfig.zoningMode} onChange={e => setKioskGlobalConfig({ ...kioskGlobalConfig, zoningMode: e.target.value })}>
                                                <option value="NORMAL">NORMAL</option>
                                                <option value="MAIN">MAIN</option>
                                                <option value="ZONING">ZONING</option>
                                                <option value="RESERVE">RESERVE</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500 block mb-1">Zoning Code</label>
                                            <input className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-xs" value={kioskGlobalConfig.zoningCode} onChange={e => setKioskGlobalConfig({ ...kioskGlobalConfig, zoningCode: e.target.value })} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Device List */}
                            <div className="space-y-3">
                                {kioskDevices.length === 0 && (
                                    <div className="text-center text-gray-600 py-8 text-sm">No devices added yet.</div>
                                )}
                                {kioskDevices.map(dev => (
                                    <div key={dev.id} className="bg-[#161b22] border border-gray-700 rounded-lg p-4 relative group">
                                        <button onClick={() => setKioskDevices(kioskDevices.filter(d => d.id !== dev.id))} className="absolute top-2 right-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs">Delete</button>
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
                        </>
                    )}

                    {activeTab === 'read' && (
                        <>
                            <div className="flex justify-end gap-3 mb-2">
                                <button
                                    onClick={handleReadAll}
                                    disabled={isKioskDeploying || readIps.length === 0}
                                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${isKioskDeploying || readIps.length === 0 ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                                >
                                    Read Configs
                                </button>
                                <button
                                    onClick={handleSaveAll}
                                    disabled={isKioskDeploying || Object.keys(readConfigs).length === 0}
                                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${isKioskDeploying || Object.keys(readConfigs).length === 0 ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                                >
                                    Save Changes
                                </button>
                            </div>

                            {/* Add IP Input */}
                            <div className="bg-[#161b22] border border-gray-800 rounded-lg p-5">
                                <h2 className="text-blue-400 text-xs font-bold uppercase mb-4 tracking-tighter">Add Devices to Read</h2>
                                <div className="flex gap-2 mb-4">
                                    <input
                                        className="flex-1 bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-xs text-white"
                                        placeholder="Device IP (e.g. 192.168.1.100)"
                                        value={newReadIp}
                                        onChange={e => setNewReadIp(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddReadIp() }}
                                    />
                                    <button onClick={handleAddReadIp} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-xs">+ Add</button>
                                </div>
                                <div className="space-y-2">
                                    {readIps.map(ip => (
                                        <div key={ip} className="flex justify-between items-center bg-[#0d1117] border border-gray-800 p-2 rounded text-xs text-gray-300">
                                            <span>{ip}</span>
                                            <button onClick={() => handleRemoveReadIp(ip)} className="text-gray-500 hover:text-red-500">&times;</button>
                                        </div>
                                    ))}
                                    {readIps.length === 0 && <div className="text-xs text-gray-600 text-center py-2">No IPs added.</div>}
                                </div>
                            </div>

                            {/* Config Editor Cards */}
                            <div className="space-y-4">
                                {Object.values(readConfigs).map((config) => (
                                    <div key={config.ip} className="bg-[#161b22] border border-blue-900/50 rounded-lg p-4">
                                        <div className="flex justify-between items-center border-b border-gray-800 pb-2 mb-3">
                                            <h3 className="text-blue-300 text-xs font-bold">{config.deviceName || 'Unknown Device'} ({config.ip})</h3>
                                            <span className="text-[10px] bg-purple-900 text-purple-300 px-2 py-0.5 rounded">Gate {config.gateNo}</span>
                                        </div>
                                        <div className="space-y-3">
                                            {[
                                                ['deviceName', 'Device Name'],
                                                ['gateNo', 'Gate No'],
                                                ['plcIp', 'PLC IP'],
                                                ['parkingCode', 'Parking Code'],
                                                ['paymentTicket', 'Payment Ticket URL'],
                                                ['serverUrl', 'Server URL'],
                                                ['localServerUrl', 'Local Server URL'],
                                            ].map(([key, label]) => (
                                                <div key={key}>
                                                    <label className="text-[10px] text-gray-500 block mb-1">
                                                        {label}
                                                        {key === 'localServerUrl' && <span className="text-red-500 ml-1">*</span>}
                                                    </label>
                                                    <input
                                                        className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-xs"
                                                        value={config[key]}
                                                        onChange={e => handleConfigChange(config.ip, key, e.target.value)}
                                                    />
                                                </div>
                                            ))}
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] text-gray-500 block mb-1">Vehicle Mode</label>
                                                    <select className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-[10px]" value={config.vehicleMode} onChange={e => handleConfigChange(config.ip, 'vehicleMode', e.target.value)}>
                                                        <option value="Car">Car</option>
                                                        <option value="Motorcycle">Motorcycle</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-gray-500 block mb-1">API Mode</label>
                                                    <select className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-[10px]" value={config.apiMode} onChange={e => handleConfigChange(config.ip, 'apiMode', e.target.value)}>
                                                        <option value="V1">V1</option>
                                                        <option value="V2">V2</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <label className="flex items-center gap-2 cursor-pointer mt-1">
                                                    <input type="checkbox" checked={config.isSpecialEntrance} onChange={e => handleConfigChange(config.ip, 'isSpecialEntrance', e.target.checked)} className="w-3 h-3 accent-blue-500" />
                                                    <span className="text-[10px] text-gray-300">Special Entrance</span>
                                                </label>
                                                <div>
                                                    <label className="text-[10px] text-gray-500 block mb-1">Timeout (Sec)</label>
                                                    <input type="number" className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-[10px]" value={config.screenTimeoutSec} onChange={e => handleConfigChange(config.ip, 'screenTimeoutSec', parseInt(e.target.value))} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                </div>

                {/* Status Log - Shared between tabs */}
                <div className="lg:col-span-2">
                    <div className="bg-[#090c10] border border-gray-800 rounded-lg p-5 h-[70vh] flex flex-col">
                        <h2 className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">Deployment Log</h2>
                        {isKioskDeploying && (
                            <div className="mb-4">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-blue-400">Progress</span>
                                    <span className="text-blue-400">{kioskProgress}%</span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-2.5">
                                    <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${kioskProgress}%` }}></div>
                                </div>
                            </div>
                        )}
                        <pre className="text-[11px] text-green-400 font-mono whitespace-pre-wrap leading-5 flex-1 overflow-y-auto bg-black/50 p-3 rounded border border-gray-800/50 text-left">
                            {kioskStatus || 'Waiting for action...'}
                        </pre>
                    </div>
                </div>
            </div>

            {/* Modal - Add Kiosk Device (for Install tab) */}
            {showKioskModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-[#161b22] border border-gray-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-6">Add Kiosk Device</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-500">Device IP (ADB over WiFi)</label>
                                <input className="w-full bg-[#0d1117] border border-gray-800 rounded p-2 mt-1 text-sm" placeholder="192.168.1.100" value={newKioskDev.ip} onChange={e => setNewKioskDev({ ...newKioskDev, ip: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Device Name</label>
                                <input className="w-full bg-[#0d1117] border border-gray-800 rounded p-2 mt-1 text-sm" placeholder="asus-kiosk-sixx-in-01" value={newKioskDev.deviceName} onChange={e => setNewKioskDev({ ...newKioskDev, deviceName: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Gate No</label>
                                <input className="w-full bg-[#0d1117] border border-gray-800 rounded p-2 mt-1 text-sm" value={newKioskDev.gateNo} onChange={e => setNewKioskDev({ ...newKioskDev, gateNo: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">PLC/Modbus IP</label>
                                <input className="w-full bg-[#0d1117] border border-gray-800 rounded p-2 mt-1 text-sm" placeholder="10.10.11.10" value={newKioskDev.plcIp} onChange={e => setNewKioskDev({ ...newKioskDev, plcIp: e.target.value })} />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setShowKioskModal(false)} className="flex-1 text-gray-400 hover:text-white text-sm">Cancel</button>
                                <button onClick={handleAddKioskDevice} className="flex-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-2 rounded-lg text-sm font-bold transition-colors">Add Device</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default EntranceKioskDeploy;
