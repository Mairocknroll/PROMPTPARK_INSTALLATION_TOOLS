import React, { useState, useEffect } from 'react';
import { ConfigureHikvisionISAPI } from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';

function HikConfig() {
    const [hikTargetIp, setHikTargetIp] = useState('');
    const [hikTargetPort, setHikTargetPort] = useState('8000');
    const [hikCameras, setHikCameras] = useState([]);
    const [showHikModal, setShowHikModal] = useState(false);
    const [newHikCam, setNewHikCam] = useState({ ip: '', username: 'admin', password: 'Jp@rk1ng', type: 'ENTRY', gateNo: '1' });
    const [hikStatus, setHikStatus] = useState('');
    const [isHikApplying, setIsHikApplying] = useState(false);
    const [hikProgress, setHikProgress] = useState(0);

    useEffect(() => {
        EventsOn("hik-progress", (data) => {
            setHikProgress(data.progress);
            setHikStatus(prev => prev + '\n' + data.message);
        });
        return () => {
            EventsOff("hik-progress");
        };
    }, []);

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

    return (
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
        </>
    );
}

export default HikConfig;
