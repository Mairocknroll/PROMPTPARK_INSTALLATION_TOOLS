import React, { useState, useMemo, useEffect } from 'react';
import { SaveEnvConfig, CheckSSHConnection, ReadRemoteEnv, SaveRemoteEnv, RedeployProxy, DeployToServer, CheckPortInUse } from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';

function ProxyInstall() {
    const [step, setStep] = useState(1);
    const [proxyTab, setProxyTab] = useState('new'); // 'new' or 'edit'
    const [showModal, setShowModal] = useState(false);

    const [system, setSystem] = useState({
        SERVER_URL: 'https://api-pms.jparkdev.co',
        PARKING_CODE: 'la26010038',
        ADDR: '0.0.0.0:8000',
        CAMERA_USER: 'admin',
        CAMERA_PASS: 'Jp@rk1ng',
        MODBUS_PORT: '504',
        MODBUS_TIMEOUT_MS: '2000',
        MODBUS_PULSE_MS: '500',
        MODBUS_SLAVE_ID: '1'
    });

    const [lanes, setLanes] = useState([]);
    const [newLane, setNewLane] = useState({ type: 'ENT', number: '01', gateIp: '', lprIp: '', licIp: '', driIp: '', hasLed: false, ledIp: '' });

    const [serverConfig, setServerConfig] = useState({
        ip: '',
        username: 'jpark',
        password: '',
        targetPath: '/home/jpark/go_local_proxy_api'
    });
    
    const [deployStatus, setDeployStatus] = useState('');
    const [isDeploying, setIsDeploying] = useState(false);
    const [deployProgress, setDeployProgress] = useState(0);
    const [isConnectionTested, setIsConnectionTested] = useState(false);

    useEffect(() => {
        setIsConnectionTested(false);
    }, [serverConfig.ip, serverConfig.username, serverConfig.password]);

    useEffect(() => {
        EventsOn("deploy-progress", (data) => {
            setDeployProgress(data.progress);
            setDeployStatus(prev => prev + '\n⏳ [' + data.progress + '%] ' + data.message);
        });
        return () => {
            EventsOff("deploy-progress");
        };
    }, []);

    const parseEnvToState = (envString) => {
        const lines = envString.split('\n');
        const newSystem = { ...system };
        const newLanes = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const [key, ...valParts] = trimmed.split('=');
            if (!key) continue;
            const value = valParts.join('=');

            if (newSystem[key] !== undefined) {
                newSystem[key] = value;
                continue;
            }

            const laneMatch = key.match(/^(ENT|EXT)_GATE_(\d+)$/);
            if (laneMatch) {
                const type = laneMatch[1];
                const suffix = laneMatch[2];
                newLanes.push({
                    id: Date.now() + Math.random(),
                    type: type,
                    number: suffix,
                    gateIp: value,
                    lprIp: '',
                    licIp: '',
                    driIp: '',
                    hasLed: false,
                    ledIp: ''
                });
            } else {
                const propMatch = key.match(/^(LPR|LIC|DRI|HIK_LED_MAIN)_(IN|OUT|ENT|EXT)_(\d+)$/);
                if (propMatch) {
                    const prop = propMatch[1];
                    const io = propMatch[2];
                    const suffix = propMatch[3];
                    const targetType = (io === 'IN' || io === 'ENT') ? 'ENT' : 'EXT';

                    const lane = newLanes.find(l => l.number === suffix && l.type === targetType);
                    if (lane) {
                        if (prop === 'LPR') lane.lprIp = value;
                        if (prop === 'LIC') lane.licIp = value;
                        if (prop === 'DRI') lane.driIp = value;
                        if (prop === 'HIK_LED_MAIN') {
                            lane.hasLed = true;
                            lane.ledIp = value;
                        }
                    }
                }
            }
        }
        setSystem(newSystem);
        setLanes(newLanes);
    };

    const envContent = useMemo(() => {
        let lines = [];
        Object.entries(system).forEach(([k, v]) => {
            if (k === 'CAMERA_USER') lines.push(''); 
            lines.push(`${k}=${v}`);
        });

        lanes.forEach(lane => {
            const suffix = lane.number;
            const io = lane.type === 'ENT' ? 'IN' : 'OUT';
            lines.push(`\n# --- ${lane.type}-${suffix} ---`);
            lines.push(`${lane.type}_GATE_${suffix}=${lane.gateIp}`);
            lines.push(`LPR_${io}_${suffix}=${lane.lprIp}`);
            lines.push(`LIC_${io}_${suffix}=${lane.licIp}`);
            lines.push(`DRI_${io}_${suffix}=${lane.driIp}`);
            if (lane.hasLed) {
                lines.push(`HIK_LED_MAIN_${lane.type}_${suffix}=${lane.ledIp}`);
            }
            lines.push(`# --- ${lane.type}-${suffix} ---`);
        });

        return lines.join('\n');
    }, [system, lanes]);

    const handleOpenAddLaneModal = () => {
        setNewLane({ type: 'ENT', number: String(lanes.length + 1).padStart(2, '0'), gateIp: '', lprIp: '', licIp: '', driIp: '', hasLed: false, ledIp: '' });
        setShowModal(true);
    };

    const handleAddLane = () => {
        if (!newLane.gateIp) {
            alert('Gate IP is required!');
            return;
        }
        if (newLane.id) {
            setLanes(lanes.map(l => l.id === newLane.id ? newLane : l));
        } else {
            setLanes([...lanes, { ...newLane, id: Date.now() }]);
        }
        setShowModal(false);
    };

    const handleGateIpBlur = () => {
        if (!newLane.gateIp) return;
        const parts = newLane.gateIp.split('.');
        if (parts.length === 4) {
            const lastNum = parseInt(parts[3], 10);
            if (!isNaN(lastNum)) {
                const prefix = parts.slice(0, 3).join('.');
                setNewLane(prev => ({
                    ...prev,
                    lprIp: prev.lprIp || `${prefix}.${lastNum + 20}`,
                    licIp: prev.licIp || `${prefix}.${lastNum + 30}`,
                    driIp: prev.driIp || `${prefix}.${lastNum + 40}`
                }));
            }
        }
    };

    const handleSave = async () => {
        const result = await SaveEnvConfig(envContent);
        alert(result);
    };

    const handleCheckConnection = async () => {
        if (!serverConfig.ip || !serverConfig.username || !serverConfig.password) {
            alert("Please fill in IP, Username, and Password");
            return;
        }
        setDeployStatus('Checking connection...');
        const result = await CheckSSHConnection(serverConfig.ip, serverConfig.username, serverConfig.password);
        if (result === 'Success') {
            setDeployStatus('✅ SSH Connection Successful!');
            setIsConnectionTested(true);
        } else {
            setDeployStatus('❌ Connection Failed: ' + result);
            setIsConnectionTested(false);
        }
    };

    const handleReadEnv = async () => {
        if (!serverConfig.ip || !serverConfig.username || !serverConfig.password || !serverConfig.targetPath) {
            alert("Please fill in all server details.");
            return;
        }
        setDeployStatus('Reading .env from server...');
        try {
            const result = await ReadRemoteEnv(serverConfig.ip, serverConfig.username, serverConfig.password, serverConfig.targetPath);
            parseEnvToState(result);
            setDeployStatus('✅ Successfully read and parsed .env from server!');
            setIsConnectionTested(true);
        } catch (e) {
            setDeployStatus('❌ Failed to read .env: ' + e);
            setIsConnectionTested(false);
        }
    };

    const handleSaveRemoteEnv = async () => {
        setIsDeploying(true);
        setDeployStatus('Saving .env to server...');
        try {
            await SaveRemoteEnv(serverConfig.ip, serverConfig.username, serverConfig.password, serverConfig.targetPath, envContent);
            setDeployStatus('✅ Successfully saved .env to server!');
        } catch (e) {
            setDeployStatus('❌ Failed to save .env: ' + e);
        }
        setIsDeploying(false);
    };

    const handleRedeployRemoteEnv = async () => {
        setIsDeploying(true);
        setDeployStatus('Saving .env and redeploying proxy (docker compose down & up)...');
        try {
            await SaveRemoteEnv(serverConfig.ip, serverConfig.username, serverConfig.password, serverConfig.targetPath, envContent);
            await RedeployProxy(serverConfig.ip, serverConfig.username, serverConfig.password, serverConfig.targetPath);
            setDeployStatus('✅ Successfully saved .env and redeployed proxy!');
        } catch (e) {
            setDeployStatus('❌ Failed to redeploy: ' + e);
        }
        setIsDeploying(false);
    };

    const handleDeploy = async () => {
        if (!serverConfig.ip || !serverConfig.username || !serverConfig.password || !serverConfig.targetPath) {
            alert("Please fill in all server details.");
            return;
        }

        if (!isConnectionTested) {
            alert("Please test SSH connection first before deploying.");
            return;
        }

        const isPortInUse = await CheckPortInUse(serverConfig.ip, serverConfig.username, serverConfig.password, 8000);
        if (isPortInUse) {
            const proceed = window.confirm("⚠️ Docker Port 8000 is already in use on the server.\nAre you sure you want to proceed and potentially overwrite or conflict with the existing process?");
            if (!proceed) return;
        }

        setIsDeploying(true);
        setDeployProgress(0);
        setDeployStatus('🚀 Starting deployment...');
        try {
            const result = await DeployToServer(serverConfig.ip, serverConfig.username, serverConfig.password, serverConfig.targetPath, envContent);
            setDeployStatus(prev => prev + '\n✅ Deploy Result:\n' + result);
            setDeployProgress(100);
        } catch (e) {
            setDeployStatus(prev => prev + '\n❌ Deploy Error: ' + e);
            setDeployProgress(0);
        }
        setIsDeploying(false);
    };

    return (
        <>
            <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Local Proxy API</h2>
                    <p className="text-xs text-gray-500 mt-1">Manage local proxy installation and configuration</p>
                </div>
                <div className="flex bg-[#090c10] p-1 rounded-lg border border-gray-800">
                    <button
                        onClick={() => { setProxyTab('new'); setStep(1); }}
                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${proxyTab === 'new' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        New Install
                    </button>
                    <button
                        onClick={() => { setProxyTab('edit'); setStep(1); }}
                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${proxyTab === 'edit' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Edit (Revise)
                    </button>
                </div>
            </div>

            {proxyTab === 'new' && (
                <div className="mb-4 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-gray-400">Step {step}: {step === 1 ? 'Configuration' : 'Deploy to Server'}</h3>
                    <div className="flex gap-3">
                        {step === 1 ? (
                            <>
                                <button onClick={handleOpenAddLaneModal} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm transition-all">+ Add Lane</button>
                                <button onClick={handleSave} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm transition-all font-bold">Save Local</button>
                                <button onClick={() => setStep(2)} disabled={lanes.length === 0} className={`px-4 py-2 rounded-md text-sm transition-all font-bold ${lanes.length === 0 ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}>Next Step</button>
                            </>
                        ) : (
                            <button onClick={() => setStep(1)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm transition-all">⬅️ Back to Config</button>
                        )}
                    </div>
                </div>
            )}

            {proxyTab === 'new' && step === 1 ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Config Lists */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* System Config Card */}
                        <div className="bg-[#161b22] border border-gray-800 rounded-lg p-5">
                            <h2 className="text-blue-400 text-xs font-bold uppercase mb-4 tracking-tighter">System Base Config</h2>
                            <div className="grid grid-cols-2 gap-4">
                                {Object.keys(system).map(key => (
                                    <div key={key}>
                                        <label className="text-[10px] text-gray-500 block mb-1">{key}</label>
                                        <input
                                            className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-sm"
                                            value={system[key]}
                                            onChange={(e) => setSystem({ ...system, [key]: e.target.value })}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Lanes List */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {lanes.map((lane) => (
                                <div key={lane.id} className="bg-[#161b22] border border-gray-700 rounded-lg p-4 relative group">
                                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setNewLane(lane); setShowModal(true); }} className="text-gray-400 hover:text-blue-400 text-xs font-bold transition-colors">Edit</button>
                                        <button onClick={() => setLanes(lanes.filter(l => l.id !== lane.id))} className="text-gray-400 hover:text-red-500 text-xs font-bold transition-colors">Delete</button>
                                    </div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className={`text-[10px] px-2 py-0.5 rounded ${lane.type === 'ENT' ? 'bg-green-900 text-green-300' : 'bg-orange-900 text-orange-300'}`}>
                                            {lane.type === 'ENT' ? 'ENTRY' : 'EXIT'} {lane.number}
                                        </span>
                                    </div>
                                    <div className="space-y-1 text-xs">
                                        <p><span className="text-gray-500">Gate:</span> {lane.gateIp}</p>
                                        <p><span className="text-gray-500">LPR:</span> {lane.lprIp}</p>
                                        <p><span className="text-gray-500">LIC:</span> {lane.licIp}</p>
                                        <p><span className="text-gray-500">DRI:</span> {lane.driIp}</p>
                                        {lane.hasLed && <p><span className="text-blue-500">LED:</span> {lane.ledIp}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Live Preview */}
                    <div className="bg-[#090c10] border border-gray-800 rounded-lg p-5 h-[70vh] overflow-y-auto sticky top-8">
                        <h2 className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">Live .env Preview</h2>
                        <pre className="text-[11px] text-green-500 font-mono whitespace-pre-wrap leading-5">
                            {envContent}
                        </pre>
                    </div>
                </div>
            ) : proxyTab === 'new' && step === 2 ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-[#161b22] border border-gray-800 rounded-lg p-5">
                            <h2 className="text-blue-400 text-xs font-bold uppercase mb-4 tracking-tighter">Server SSH Config</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-gray-500 block mb-1">Server IP Address (e.g. 192.168.1.100)</label>
                                    <input
                                        className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-sm"
                                        value={serverConfig.ip}
                                        onChange={(e) => setServerConfig({ ...serverConfig, ip: e.target.value })}
                                        placeholder="192.168.1.100"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 block mb-1">Username</label>
                                    <input
                                        className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-sm"
                                        value={serverConfig.username}
                                        onChange={(e) => setServerConfig({ ...serverConfig, username: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 block mb-1">Password</label>
                                    <input
                                        type="password"
                                        className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-sm"
                                        value={serverConfig.password}
                                        onChange={(e) => setServerConfig({ ...serverConfig, password: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 block mb-1">Target Directory Path</label>
                                    <input
                                        className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-sm text-yellow-500"
                                        value={serverConfig.targetPath}
                                        onChange={(e) => setServerConfig({ ...serverConfig, targetPath: e.target.value })}
                                    />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={handleCheckConnection}
                                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-xs transition-all"
                                    >
                                        Test Connection
                                    </button>
                                    <button
                                        onClick={handleDeploy}
                                        disabled={isDeploying || !isConnectionTested}
                                        className={`flex-2 py-2 rounded text-xs font-bold transition-all ${isDeploying || !isConnectionTested ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                                    >
                                        {isDeploying ? 'Deploying...' : 'Deploy to Server'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-2">
                        <div className="bg-[#090c10] border border-gray-800 rounded-lg p-5 h-[70vh] flex flex-col">
                            <h2 className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">Deployment Status</h2>

                            {isDeploying && (
                                <div className="mb-4">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-blue-400">Progress</span>
                                        <span className="text-blue-400">{deployProgress}%</span>
                                    </div>
                                    <div className="w-full bg-gray-800 rounded-full h-2.5">
                                        <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${deployProgress}%` }}></div>
                                    </div>
                                </div>
                            )}

                            <pre className="text-[11px] text-green-400 font-mono whitespace-pre-wrap leading-5 flex-1 overflow-y-auto bg-black/50 p-3 rounded border border-gray-800/50">
                                {deployStatus || "Waiting to deploy..."}
                            </pre>
                        </div>
                    </div>
                </div>
            ) : null}

            {proxyTab === 'edit' && (
                <div className="space-y-6">
                    <div className="bg-[#161b22] border border-gray-800 rounded-lg p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-blue-400 text-xs font-bold uppercase tracking-tighter">Server Connection</h2>
                            <div className="flex gap-2">
                                <button onClick={handleReadEnv} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-xs font-bold rounded">Read .env</button>
                                <button onClick={handleSaveRemoteEnv} disabled={!isConnectionTested} className={`px-3 py-1.5 text-xs font-bold rounded ${!isConnectionTested ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-500 text-white'}`}>Save Env Only</button>
                                <button onClick={handleRedeployRemoteEnv} disabled={!isConnectionTested} className={`px-3 py-1.5 text-xs font-bold rounded ${!isConnectionTested ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}>Save & Redeploy</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            <div>
                                <label className="text-[10px] text-gray-500 block mb-1">Server IP</label>
                                <input className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-sm" value={serverConfig.ip} onChange={e => setServerConfig({ ...serverConfig, ip: e.target.value })} placeholder="192.168.1.100" />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 block mb-1">Username</label>
                                <input className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-sm" value={serverConfig.username} onChange={e => setServerConfig({ ...serverConfig, username: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 block mb-1">Password</label>
                                <input type="password" className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-sm" value={serverConfig.password} onChange={e => setServerConfig({ ...serverConfig, password: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 block mb-1">Target Directory</label>
                                <input className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-sm text-yellow-500" value={serverConfig.targetPath} onChange={e => setServerConfig({ ...serverConfig, targetPath: e.target.value })} />
                            </div>
                        </div>
                        <div className="mt-4 text-xs">
                            {deployStatus && <span className={deployStatus.includes('✅') ? 'text-green-400' : 'text-red-400'}>{deployStatus}</span>}
                        </div>
                    </div>

                    {isConnectionTested && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-[#161b22] border border-gray-800 rounded-lg p-5">
                                    <h2 className="text-blue-400 text-xs font-bold uppercase mb-4 tracking-tighter">System Base Config</h2>
                                    <div className="grid grid-cols-2 gap-4">
                                        {Object.keys(system).map(key => (
                                            <div key={key}>
                                                <label className="text-[10px] text-gray-500 block mb-1">{key}</label>
                                                <input className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-sm" value={system[key]} onChange={(e) => setSystem({ ...system, [key]: e.target.value })} />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-between items-center mt-6 mb-2">
                                    <h2 className="text-blue-400 text-xs font-bold uppercase tracking-tighter">Lanes Configuration</h2>
                                    <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs transition-all">+ Add Lane</button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {lanes.map((lane, idx) => (
                                        <div key={lane.id} className="bg-[#161b22] border border-gray-700 rounded-lg p-4 relative">
                                            <button onClick={() => setLanes(lanes.filter(l => l.id !== lane.id))} className="absolute top-2 right-2 text-gray-600 hover:text-red-500 text-xs">Delete</button>
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className={`text-[10px] px-2 py-0.5 rounded ${lane.type === 'ENT' ? 'bg-green-900 text-green-300' : 'bg-orange-900 text-orange-300'}`}>
                                                    {lane.type === 'ENT' ? 'ENTRY' : 'EXIT'} {lane.number}
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                <div>
                                                    <label className="text-[10px] text-gray-500 block">Gate IP</label>
                                                    <input className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-xs" value={lane.gateIp} onChange={(e) => {
                                                        const newLanes = [...lanes];
                                                        newLanes[idx].gateIp = e.target.value;
                                                        setLanes(newLanes);
                                                    }} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-gray-500 block">LPR IP</label>
                                                    <input className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-xs" value={lane.lprIp} onChange={(e) => {
                                                        const newLanes = [...lanes];
                                                        newLanes[idx].lprIp = e.target.value;
                                                        setLanes(newLanes);
                                                    }} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-gray-500 block">LIC IP</label>
                                                    <input className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-xs" value={lane.licIp} onChange={(e) => {
                                                        const newLanes = [...lanes];
                                                        newLanes[idx].licIp = e.target.value;
                                                        setLanes(newLanes);
                                                    }} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-gray-500 block">DRI IP</label>
                                                    <input className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1 text-xs" value={lane.driIp} onChange={(e) => {
                                                        const newLanes = [...lanes];
                                                        newLanes[idx].driIp = e.target.value;
                                                        setLanes(newLanes);
                                                    }} />
                                                </div>
                                                {lane.hasLed && (
                                                    <div>
                                                        <label className="text-[10px] text-blue-500 block">LED IP</label>
                                                        <input className="w-full bg-[#0d1117] border border-blue-900/50 rounded px-2 py-1 text-xs text-blue-400" value={lane.ledIp} onChange={(e) => {
                                                            const newLanes = [...lanes];
                                                            newLanes[idx].ledIp = e.target.value;
                                                            setLanes(newLanes);
                                                        }} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-[#090c10] border border-gray-800 rounded-lg p-5 h-[70vh] overflow-y-auto sticky top-8">
                                <h2 className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">Live .env Preview</h2>
                                <pre className="text-[11px] text-green-500 font-mono whitespace-pre-wrap leading-5">
                                    {envContent}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal - Add Lane */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-[#161b22] border border-gray-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-6">{newLane.id ? 'Edit Lane' : 'Setup New Lane'}</h2>
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500">Type</label>
                                    <select
                                        className="w-full bg-[#0d1117] border border-gray-800 rounded p-2 mt-1"
                                        value={newLane.type}
                                        onChange={e => setNewLane({ ...newLane, type: e.target.value })}
                                    >
                                        <option value="ENT">ENTRY</option>
                                        <option value="EXT">EXIT</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500">Number (01, 02...)</label>
                                    <input className="w-full bg-[#0d1117] border border-gray-800 rounded p-2 mt-1" value={newLane.number} onChange={e => setNewLane({ ...newLane, number: e.target.value })} />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-gray-500">Gate IP</label>
                                <input
                                    className="w-full bg-[#0d1117] border border-gray-800 rounded p-2 mt-1 text-sm"
                                    placeholder="10.10.11.10"
                                    value={newLane.gateIp}
                                    onChange={e => setNewLane({ ...newLane, gateIp: e.target.value })}
                                    onBlur={handleGateIpBlur}
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div><label className="text-[10px] text-gray-500">LPR IP</label><input className="w-full bg-[#0d1117] border border-gray-800 rounded p-1.5 mt-1 text-xs" value={newLane.lprIp} onChange={e => setNewLane({ ...newLane, lprIp: e.target.value })} /></div>
                                <div><label className="text-[10px] text-gray-500">LIC IP</label><input className="w-full bg-[#0d1117] border border-gray-800 rounded p-1.5 mt-1 text-xs" value={newLane.licIp} onChange={e => setNewLane({ ...newLane, licIp: e.target.value })} /></div>
                                <div><label className="text-[10px] text-gray-500">DRI IP</label><input className="w-full bg-[#0d1117] border border-gray-800 rounded p-1.5 mt-1 text-xs" value={newLane.driIp} onChange={e => setNewLane({ ...newLane, driIp: e.target.value })} /></div>
                            </div>

                            <div className="border-t border-gray-800 pt-4 mt-4">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={newLane.hasLed} onChange={e => setNewLane({ ...newLane, hasLed: e.target.checked })} className="w-4 h-4 accent-blue-500" />
                                    <span className="text-sm text-gray-300">Include LED Display?</span>
                                </label>

                                {newLane.hasLed && (
                                    <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                                        <label className="text-xs text-gray-500">LED IP Address</label>
                                        <input className="w-full bg-[#0d1117] border border-gray-800 rounded p-2 mt-1 text-sm text-blue-400" placeholder="10.10.34.90" value={newLane.ledIp} onChange={e => setNewLane({ ...newLane, ledIp: e.target.value })} />
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-6">
                                <button onClick={() => setShowModal(false)} className="flex-1 text-gray-400 hover:text-white text-sm">Cancel</button>
                                <button onClick={handleAddLane} className="flex-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-2 rounded-lg text-sm font-bold transition-colors">{newLane.id ? 'Save Changes' : 'Apply Lane'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default ProxyInstall;
