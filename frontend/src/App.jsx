import { useState, useMemo, useEffect } from 'react';
import { SaveEnvConfig, CheckSSHConnection, DeployToServer, CheckPortInUse, ConfigureHikvisionISAPI, BrowseAPKFile, DeployKioskAPK } from '../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime';

function App() {
    const [activeMenu, setActiveMenu] = useState('install_proxy');
    const [step, setStep] = useState(1);

    // 1. State สำหรับ System Config (ค่าคงที่)
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

    // 2. State สำหรับ Lanes (ทางเข้า/ออก)
    const [lanes, setLanes] = useState([]);
    const [showModal, setShowModal] = useState(false);

    // 3. Temporary state สำหรับ Modal
    const [newLane, setNewLane] = useState({ type: 'ENT', number: '01', gateIp: '', lprIp: '', licIp: '', driIp: '', hasLed: false, ledIp: '' });

    // 4. State สำหรับ Server Config (Deploy)
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

    // 5. State สำหรับ Hikvision Config
    const [hikTargetIp, setHikTargetIp] = useState('');
    const [hikTargetPort, setHikTargetPort] = useState('8000');
    const [hikCameras, setHikCameras] = useState([]);
    const [showHikModal, setShowHikModal] = useState(false);
    const [newHikCam, setNewHikCam] = useState({ ip: '', username: 'admin', password: 'Jp@rk1ng', type: 'ENTRY', gateNo: '1' });
    const [hikStatus, setHikStatus] = useState('');
    const [isHikApplying, setIsHikApplying] = useState(false);
    const [hikProgress, setHikProgress] = useState(0);

    // 6. State สำหรับ Kiosk APK Deploy
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
    const [kioskStatus, setKioskStatus] = useState('');
    const [isKioskDeploying, setIsKioskDeploying] = useState(false);
    const [kioskProgress, setKioskProgress] = useState(0);

    // Kiosk Deploy (Exit) State
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

    // รีเซ็ตการทดสอบการเชื่อมต่อหากมีการแก้ไขข้อมูล Server
    useEffect(() => {
        setIsConnectionTested(false);
    }, [serverConfig.ip, serverConfig.username, serverConfig.password]);

    useEffect(() => {
        EventsOn("deploy-progress", (data) => {
            setDeployProgress(data.progress);
            setDeployStatus(prev => prev + '\n⏳ [' + data.progress + '%] ' + data.message);
        });
        EventsOn("hik-progress", (data) => {
            setHikProgress(data.progress);
            setHikStatus(prev => prev + '\n' + data.message);
        });
        EventsOn("kiosk-progress", (data) => {
            setKioskProgress(data.progress);
            setKioskStatus(prev => prev + '\n' + data.message);
        });
        EventsOn("exit-kiosk-progress", (data) => {
            setExitKioskProgress(data.progress);
            setExitKioskStatus(prev => prev + '\n' + data.message);
        });
        return () => {
            EventsOff("deploy-progress");
            EventsOff("hik-progress");
            EventsOff("kiosk-progress");
            EventsOff("exit-kiosk-progress");
        };
    }, []);

    // Function: สร้างเนื้อหาไฟล์ .env จาก State
    const envContent = useMemo(() => {
        let lines = [];
        Object.entries(system).forEach(([k, v]) => {
            if (k === 'CAMERA_USER') lines.push(''); // เว้นวรรคตาม format พี่
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

    const handleAddLane = () => {
        setLanes([...lanes, { ...newLane, id: Date.now() }]);
        setShowModal(false);
        setNewLane({ type: 'ENT', number: String(lanes.length + 2).padStart(2, '0'), gateIp: '', lprIp: '', licIp: '', driIp: '', hasLed: false, ledIp: '' });
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

    const handleAddHikCamera = () => {
        setHikCameras([...hikCameras, { ...newHikCam, id: Date.now() }]);
        setShowHikModal(false);
        setNewHikCam({ ip: '', username: 'admin', password: 'Jp@rk1ng', type: 'ENTRY', gateNo: String(parseInt(newHikCam.gateNo) + 1) });
    };

    const handleApplyHik = async () => {
        if (!hikTargetIp || !hikTargetPort || hikCameras.length === 0) {
            alert('Please set Target IP, Port and add at least one camera.');
            return;
        }
        setIsHikApplying(true);
        setHikProgress(0);
        setHikStatus('🚀 Starting ISAPI configuration...');
        try {
            await ConfigureHikvisionISAPI({
                targetIp: hikTargetIp,
                targetPort: hikTargetPort,
                cameras: hikCameras.map(c => ({ ip: c.ip, username: c.username, password: c.password, type: c.type, gateNo: c.gateNo }))
            });
        } catch (e) {
            setHikStatus(prev => prev + '\n❌ Error: ' + e);
        }
        setIsHikApplying(false);
    };

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
        <div className="min-h-screen bg-[#0d1117] text-gray-300 flex font-mono h-screen overflow-hidden">
            {/* Sidebar */}
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
                </div>
                <div className="text-[10px] text-gray-600 text-center pb-2 pt-4 border-t border-gray-800">v1.0.0</div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-6xl mx-auto">
                    {activeMenu === 'install_proxy' && (
                        <>
                            <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">Local Proxy API</h2>
                                    <p className="text-xs text-gray-500 mt-1">Step {step}: {step === 1 ? 'Configuration' : 'Deploy to Server'}</p>
                                </div>
                                <div className="flex gap-3">
                                    {step === 1 ? (
                                        <>
                                            <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm transition-all">+ Add Lane</button>
                                            <button onClick={handleSave} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm transition-all text-bold">Save Local</button>
                                            <button onClick={() => setStep(2)} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-md text-sm transition-all font-bold">Next Step ➡️</button>
                                        </>
                                    ) : (
                                        <button onClick={() => setStep(1)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm transition-all">⬅️ Back to Config</button>
                                    )}
                                </div>
                            </div>

                            {step === 1 ? (
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
                                                    <button onClick={() => setLanes(lanes.filter(l => l.id !== lane.id))} className="absolute top-2 right-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">Delete</button>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className={`text-[10px] px-2 py-0.5 rounded ${lane.type === 'ENT' ? 'bg-green-900 text-green-300' : 'bg-orange-900 text-orange-300'}`}>
                                                            {lane.type === 'ENT' ? 'ENTRY' : 'EXIT'} {lane.number}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-1 text-xs">
                                                        <p><span className="text-gray-500">Gate:</span> {lane.gateIp}</p>
                                                        <p><span className="text-gray-500">LPR:</span> {lane.lprIp}</p>
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
                            ) : (
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
                            )}
                        </>
                    )}

                    {activeMenu === 'hik_config' && (
                        <>
                            <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">HIK LPR Config</h2>
                                    <p className="text-xs text-gray-500 mt-1">Configure Hikvision LPR cameras to send data to your Local Proxy API</p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setShowHikModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm transition-all">+ Add Camera</button>
                                    <button
                                        onClick={handleApplyHik}
                                        disabled={isHikApplying || hikCameras.length === 0}
                                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${isHikApplying || hikCameras.length === 0 ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                                    >
                                        {isHikApplying ? 'Applying...' : 'Apply to All Cameras'}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-1 space-y-6">
                                    {/* Target Server */}
                                    <div className="bg-[#161b22] border border-gray-800 rounded-lg p-5">
                                        <h2 className="text-blue-400 text-xs font-bold uppercase mb-4 tracking-tighter">Target Local Server</h2>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[10px] text-gray-500 block mb-1">Local Proxy IP (camera จะส่ง event มาที่นี่)</label>
                                                <input
                                                    className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-sm"
                                                    placeholder="10.10.11.5"
                                                    value={hikTargetIp}
                                                    onChange={e => setHikTargetIp(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-500 block mb-1">Port</label>
                                                <input
                                                    className="w-full bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-sm"
                                                    value={hikTargetPort}
                                                    onChange={e => setHikTargetPort(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Camera List */}
                                    <div className="space-y-3">
                                        {hikCameras.length === 0 && (
                                            <div className="text-center text-gray-600 py-8 text-sm">No cameras added yet. Click "+ Add Camera".</div>
                                        )}
                                        {hikCameras.map(cam => (
                                            <div key={cam.id} className="bg-[#161b22] border border-gray-700 rounded-lg p-4 relative group">
                                                <button onClick={() => setHikCameras(hikCameras.filter(c => c.id !== cam.id))} className="absolute top-2 right-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs">Delete</button>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded ${cam.type === 'ENTRY' ? 'bg-green-900 text-green-300' : 'bg-orange-900 text-orange-300'}`}>
                                                        {cam.type} Gate {cam.gateNo}
                                                    </span>
                                                </div>
                                                <div className="text-xs space-y-1">
                                                    <p><span className="text-gray-500">Camera IP:</span> {cam.ip}</p>
                                                    <p><span className="text-gray-500">User:</span> {cam.username}</p>
                                                    <p className="text-yellow-600 text-[10px]">
                                                        → {cam.type === 'ENTRY' ? `/api/v2-202402/order/verify-member?gate_no=${cam.gateNo}` : `/api/v2-202402/order/verify-license-plate-out?gate_no=${cam.gateNo}`}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Status Log */}
                                <div className="lg:col-span-2">
                                    <div className="bg-[#090c10] border border-gray-800 rounded-lg p-5 h-[70vh] flex flex-col">
                                        <h2 className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">Configuration Log</h2>
                                        {isHikApplying && (
                                            <div className="mb-4">
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-blue-400">Progress</span>
                                                    <span className="text-blue-400">{hikProgress}%</span>
                                                </div>
                                                <div className="w-full bg-gray-800 rounded-full h-2.5">
                                                    <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${hikProgress}%` }}></div>
                                                </div>
                                            </div>
                                        )}
                                        <pre className="text-[11px] text-green-400 font-mono whitespace-pre-wrap leading-5 flex-1 overflow-y-auto bg-black/50 p-3 rounded border border-gray-800/50">
                                            {hikStatus || 'Waiting to apply...'}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {activeMenu === 'kiosk_deploy' && (
                        <>
                            <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">Entrance Kiosk Installation</h2>
                                    <p className="text-xs text-gray-500 mt-1">Install APK & push SharedPreferences config to multiple Android Kiosk devices via ADB</p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setShowKioskModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm transition-all">+ Add Device</button>
                                    <button
                                        onClick={handleDeployKiosk}
                                        disabled={isKioskDeploying || kioskDevices.length === 0}
                                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${isKioskDeploying || kioskDevices.length === 0 ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                                    >
                                        {isKioskDeploying ? 'Deploying...' : 'Deploy to All Devices'}
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
                                                    <label className="text-[10px] text-gray-500 block mb-1">{label}</label>
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
                                            <div className="text-center text-gray-600 py-8 text-sm">No devices added yet. Click "+ Add Device".</div>
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
                                </div>

                                {/* Status Log */}
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
                                        <pre className="text-[11px] text-green-400 font-mono whitespace-pre-wrap leading-5 flex-1 overflow-y-auto bg-black/50 p-3 rounded border border-gray-800/50">
                                            {kioskStatus || 'Waiting to deploy...'}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {activeMenu === 'exit_kiosk_deploy' && (
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
                        </>
                    )}
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

            {/* Modal - Add Kiosk Device */}
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
            {/* Modal - Add Lane */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-[#161b22] border border-gray-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-6">Setup New Lane</h2>
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
                                <button onClick={handleAddLane} className="flex-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-2 rounded-lg text-sm font-bold transition-colors">Apply Lane</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal - Add HIK Camera */}
            {showHikModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-[#161b22] border border-gray-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-6">Add LPR Camera</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-500">Camera IP</label>
                                <input className="w-full bg-[#0d1117] border border-gray-800 rounded p-2 mt-1 text-sm" placeholder="10.10.11.30" value={newHikCam.ip} onChange={e => setNewHikCam({ ...newHikCam, ip: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500">Username</label>
                                    <input className="w-full bg-[#0d1117] border border-gray-800 rounded p-2 mt-1 text-sm" value={newHikCam.username} onChange={e => setNewHikCam({ ...newHikCam, username: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Password</label>
                                    <input type="password" className="w-full bg-[#0d1117] border border-gray-800 rounded p-2 mt-1 text-sm" value={newHikCam.password} onChange={e => setNewHikCam({ ...newHikCam, password: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500">Direction</label>
                                    <select
                                        className="w-full bg-[#0d1117] border border-gray-800 rounded p-2 mt-1"
                                        value={newHikCam.type}
                                        onChange={e => setNewHikCam({ ...newHikCam, type: e.target.value })}
                                    >
                                        <option value="ENTRY">ENTRY (ขาเข้า)</option>
                                        <option value="EXIT">EXIT (ขาออก)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Gate No</label>
                                    <input className="w-full bg-[#0d1117] border border-gray-800 rounded p-2 mt-1 text-sm" value={newHikCam.gateNo} onChange={e => setNewHikCam({ ...newHikCam, gateNo: e.target.value })} />
                                </div>
                            </div>
                            <div className="bg-[#0d1117] border border-gray-800 rounded p-3 mt-2">
                                <p className="text-[10px] text-gray-500 mb-1">Target endpoint:</p>
                                <p className="text-xs text-yellow-500 font-mono">
                                    {newHikCam.type === 'ENTRY'
                                        ? `/api/v2-202402/order/verify-member?gate_no=${newHikCam.gateNo}`
                                        : `/api/v2-202402/order/verify-license-plate-out?gate_no=${newHikCam.gateNo}`
                                    }
                                </p>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setShowHikModal(false)} className="flex-1 text-gray-400 hover:text-white text-sm">Cancel</button>
                                <button onClick={handleAddHikCamera} className="flex-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-2 rounded-lg text-sm font-bold transition-colors">Add Camera</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;