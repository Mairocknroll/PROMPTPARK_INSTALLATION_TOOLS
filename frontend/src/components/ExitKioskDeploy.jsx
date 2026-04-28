import React, { useState, useEffect } from 'react';
import { BrowseAPKFile, DeployExitKioskAPK, ReadExitKioskConfig, UpdateExitKioskConfig } from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';

function ExitKioskDeploy() {
    const [activeTab, setActiveTab] = useState('install');

    // --- Install Tab State ---
    const [exitKioskApkPath, setExitKioskApkPath] = useState('');
    const [exitKioskDevices, setExitKioskDevices] = useState([]);
    const [showExitKioskModal, setShowExitKioskModal] = useState(false);
    const [newExitKioskDev, setNewExitKioskDev] = useState({ ip: '', deviceName: '', gateNo: '1', plcIp: '' });
    const [exitKioskGlobalConfig, setExitKioskGlobalConfig] = useState({
        parkingCode: 'la26010038',
        projectCode: '',
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
        ticketMode: 'NORMAL'
    });

    // --- Read/Edit Tab State ---
    const [readIps, setReadIps] = useState([]);
    const [newReadIp, setNewReadIp] = useState('');
    const [readConfigs, setReadConfigs] = useState({});

    // Shared Status State
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

    // --- Methods ---
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
        if (!exitKioskGlobalConfig.localServerUrl) {
            alert('Local Server URL is required!');
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
        setIsExitKioskDeploying(true);
        setExitKioskStatus('📡 Reading configs from devices...');
        let updatedConfigs = { ...readConfigs };

        for (const ip of readIps) {
            setExitKioskStatus(prev => prev + `\nReading from ${ip}...`);
            try {
                const configMap = await ReadExitKioskConfig(ip);
                if (!configMap || Object.keys(configMap).length === 0) {
                    setExitKioskStatus(prev => prev + `\n❌ No configuration data found for ${ip}.`);
                } else {
                    updatedConfigs[ip] = {
                        ip: ip,
                        deviceName: configMap.deviceNameConfig || '',
                        gateNo: configMap.gateConfig || '',
                        plcIp: configMap.plcIpConfig || '',
                        parkingCode: configMap.parkingCodeConfig || '',
                        projectCode: configMap.projectCodeConfig || '',
                        paymentTicket: configMap.paymentTicket || '',
                        serverUrl: configMap.serverConfig || '',
                        localServerUrl: configMap.localServerConfig || '',
                        vehicleMode: configMap.vehicleMode || 'Car',
                        apiMode: configMap.apiMode || 'V2',
                        zoningMode: configMap.zoningMode || 'NORMAL',
                        zoningCode: configMap.zoningCode || '',
                        zoningGateNo: configMap.zoningGateNo || '1',
                        nextZoningCode: configMap.nextZoningCode || '',
                        nextZoningGateNo: configMap.nextZoningGateNo || '',
                        isCash: configMap.isCash === 'true',
                        isQR: configMap.isQR === 'true',
                        ticketMode: configMap.ticketMode || 'NORMAL'
                    };
                    setExitKioskStatus(prev => prev + `\n✅ Read success for ${ip}`);
                }
            } catch (e) {
                setExitKioskStatus(prev => prev + `\n❌ Failed to read ${ip}: ${e}`);
            }
        }
        setReadConfigs(updatedConfigs);
        setIsExitKioskDeploying(false);
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

        setIsExitKioskDeploying(true);
        setExitKioskProgress(0);
        setExitKioskStatus('🚀 Saving configurations to devices...');
        try {
            await UpdateExitKioskConfig(configsToSave);
        } catch (e) {
            setExitKioskStatus(prev => prev + '\n❌ Error: ' + e);
        }
        setIsExitKioskDeploying(false);
    };

    return (
        <>
            <div className="flex justify-between items-center mb-6 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Exit Kiosk Installation</h2>
                    <p className="text-xs text-gray-500 mt-1">Manage Exit APK installation and SharedPreferences configurations via ADB</p>
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
                {/* Left Column */}
                <div className="lg:col-span-1 space-y-6 overflow-y-auto" style={{ maxHeight: '75vh' }}>
                    
                    {activeTab === 'install' && (
                        <>
                            <div className="flex justify-end gap-3 mb-2">
                                <button onClick={() => setShowExitKioskModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md text-xs transition-all">+ Add Device</button>
                                <button
                                    onClick={handleDeployExitKiosk}
                                    disabled={isExitKioskDeploying || exitKioskDevices.length === 0}
                                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${isExitKioskDeploying || exitKioskDevices.length === 0 ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                                >
                                    Deploy All
                                </button>
                            </div>

                            {/* APK Selection */}
                            <div className="bg-[#161b22] border border-gray-800 rounded-lg p-5">
                                <h2 className="text-blue-400 text-xs font-bold uppercase mb-4 tracking-tighter">Exit APK File</h2>
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
                                            <label className="text-[10px] text-gray-500 block mb-1">
                                                {label}
                                                {key === 'localServerUrl' && <span className="text-red-500 ml-1">*</span>}
                                            </label>
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
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={exitKioskGlobalConfig.isCash} onChange={e => setExitKioskGlobalConfig({ ...exitKioskGlobalConfig, isCash: e.target.checked })} className="w-4 h-4 accent-blue-500" />
                                            <span className="text-[10px] text-gray-300">Accept Cash</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={exitKioskGlobalConfig.isQR} onChange={e => setExitKioskGlobalConfig({ ...exitKioskGlobalConfig, isQR: e.target.checked })} className="w-4 h-4 accent-blue-500" />
                                            <span className="text-[10px] text-gray-300">Accept QR</span>
                                        </label>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 block mb-1 mt-2">Ticket Mode</label>
                                        <select className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-xs" value={exitKioskGlobalConfig.ticketMode} onChange={e => setExitKioskGlobalConfig({ ...exitKioskGlobalConfig, ticketMode: e.target.value })}>
                                            <option value="NORMAL">NORMAL</option>
                                            <option value="E-STAMP">E-STAMP</option>
                                            <option value="VISITOR">VISITOR</option>
                                            <option value="QR-PAYMENT">QR-PAYMENT</option>
                                        </select>
                                    </div>

                                    {/* Zoning Options */}
                                    <div className="bg-[#090c10] border border-gray-800 p-3 rounded-lg mt-2 space-y-2">
                                        <h3 className="text-[10px] text-gray-500 font-bold mb-1">Zoning Configuration</h3>
                                        <div>
                                            <label className="text-[10px] text-gray-500 block mb-1">Zoning Mode</label>
                                            <select className="w-full bg-[#161b22] border border-gray-800 rounded px-2 py-1 text-xs" value={exitKioskGlobalConfig.zoningMode} onChange={e => setExitKioskGlobalConfig({ ...exitKioskGlobalConfig, zoningMode: e.target.value })}>
                                                <option value="NORMAL">NORMAL</option>
                                                <option value="MAIN">MAIN</option>
                                                <option value="ZONING">ZONING</option>
                                                <option value="RESERVE">RESERVE</option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[10px] text-gray-500 block mb-1">Zoning Code</label>
                                                <input className="w-full bg-[#161b22] border border-gray-800 rounded px-2 py-1.5 text-xs" value={exitKioskGlobalConfig.zoningCode} onChange={e => setExitKioskGlobalConfig({ ...exitKioskGlobalConfig, zoningCode: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-500 block mb-1">Next Zone Code</label>
                                                <input className="w-full bg-[#161b22] border border-gray-800 rounded px-2 py-1.5 text-xs" value={exitKioskGlobalConfig.nextZoningCode} onChange={e => setExitKioskGlobalConfig({ ...exitKioskGlobalConfig, nextZoningCode: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Device List */}
                            <div className="space-y-3">
                                {exitKioskDevices.length === 0 && (
                                    <div className="text-center text-gray-600 py-8 text-sm">No devices added yet.</div>
                                )}
                                {exitKioskDevices.map(dev => (
                                    <div key={dev.id} className="bg-[#161b22] border border-gray-700 rounded-lg p-4 relative group">
                                        <button onClick={() => setExitKioskDevices(exitKioskDevices.filter(d => d.id !== dev.id))} className="absolute top-2 right-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs">Delete</button>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-900 text-blue-300">Gate {dev.gateNo}</span>
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
                                    disabled={isExitKioskDeploying || readIps.length === 0}
                                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${isExitKioskDeploying || readIps.length === 0 ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                                >
                                    Read Configs
                                </button>
                                <button
                                    onClick={handleSaveAll}
                                    disabled={isExitKioskDeploying || Object.keys(readConfigs).length === 0}
                                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${isExitKioskDeploying || Object.keys(readConfigs).length === 0 ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}
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
                                            <span className="text-[10px] bg-blue-900 text-blue-300 px-2 py-0.5 rounded">Gate {config.gateNo}</span>
                                        </div>
                                        <div className="space-y-3">
                                            {[
                                                ['deviceName', 'Device Name'],
                                                ['gateNo', 'Gate No'],
                                                ['plcIp', 'PLC IP'],
                                                ['parkingCode', 'Parking Code'],
                                                ['projectCode', 'Project Code'],
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
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" checked={config.isCash} onChange={e => handleConfigChange(config.ip, 'isCash', e.target.checked)} className="w-3 h-3 accent-blue-500" />
                                                    <span className="text-[10px] text-gray-300">Accept Cash</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" checked={config.isQR} onChange={e => handleConfigChange(config.ip, 'isQR', e.target.checked)} className="w-3 h-3 accent-blue-500" />
                                                    <span className="text-[10px] text-gray-300">Accept QR</span>
                                                </label>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-500 block mb-1 mt-2">Ticket Mode</label>
                                                <select className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-[10px]" value={config.ticketMode} onChange={e => handleConfigChange(config.ip, 'ticketMode', e.target.value)}>
                                                    <option value="NORMAL">NORMAL</option>
                                                    <option value="E-STAMP">E-STAMP</option>
                                                    <option value="VISITOR">VISITOR</option>
                                                    <option value="QR-PAYMENT">QR-PAYMENT</option>
                                                </select>
                                            </div>

                                            {/* Zoning Options */}
                                            <div className="bg-[#090c10] border border-gray-800 p-3 rounded-lg mt-2 space-y-2">
                                                <h3 className="text-[10px] text-gray-500 font-bold mb-1">Zoning Configuration</h3>
                                                <div>
                                                    <label className="text-[10px] text-gray-500 block mb-1">Zoning Mode</label>
                                                    <select className="w-full bg-[#161b22] border border-gray-800 rounded px-2 py-1 text-[10px]" value={config.zoningMode} onChange={e => handleConfigChange(config.ip, 'zoningMode', e.target.value)}>
                                                        <option value="NORMAL">NORMAL</option>
                                                        <option value="MAIN">MAIN</option>
                                                        <option value="ZONING">ZONING</option>
                                                        <option value="RESERVE">RESERVE</option>
                                                    </select>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[10px] text-gray-500 block mb-1">Zoning Code</label>
                                                        <input className="w-full bg-[#161b22] border border-gray-800 rounded px-2 py-1 text-[10px]" value={config.zoningCode} onChange={e => handleConfigChange(config.ip, 'zoningCode', e.target.value)} />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] text-gray-500 block mb-1">Next Zone Code</label>
                                                        <input className="w-full bg-[#161b22] border border-gray-800 rounded px-2 py-1 text-[10px]" value={config.nextZoningCode} onChange={e => handleConfigChange(config.ip, 'nextZoningCode', e.target.value)} />
                                                    </div>
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
                        <pre className="text-[11px] text-green-400 font-mono whitespace-pre-wrap leading-5 flex-1 overflow-y-auto bg-black/50 p-3 rounded border border-gray-800/50 text-left">
                            {exitKioskStatus || 'Waiting for action...'}
                        </pre>
                    </div>
                </div>
            </div>

            {/* Modal - Add Kiosk Device */}
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
                                <input className="w-full bg-[#0d1117] border border-gray-800 rounded p-2 mt-1 text-sm" placeholder="10.10.11.11" value={newExitKioskDev.plcIp} onChange={e => setNewExitKioskDev({ ...newExitKioskDev, plcIp: e.target.value })} />
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
