import React, { useState, useEffect } from 'react';
import { BrowseAPKFile, DeployGenericAPK, SaveSitePreset, GetSitePresets, DeleteSitePreset } from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';

function GeneralAppDeploy() {
    const [apkPath, setApkPath] = useState('');
    const [ips, setIps] = useState([]);
    const [newIp, setNewIp] = useState('');
    const [status, setStatus] = useState('');
    const [progress, setProgress] = useState(0);
    const [isDeploying, setIsDeploying] = useState(false);
    
    const [presets, setPresets] = useState([]);
    const [selectedPresetId, setSelectedPresetId] = useState('');
    const [siteName, setSiteName] = useState('');

    useEffect(() => {
        EventsOn("generic-deploy-progress", (data) => {
            setProgress(data.progress);
            setStatus(prev => prev + '\n' + data.message);
        });
        loadPresets();
        return () => {
            EventsOff("generic-deploy-progress");
        };
    }, []);

    const loadPresets = async () => {
        const list = await GetSitePresets();
        setPresets(list?.filter(p => p.type === 'general') || []);
    };

    const handleSavePreset = async () => {
        if (!siteName) {
            alert('Please enter a Site Name.');
            return;
        }
        const preset = {
            id: selectedPresetId,
            siteName: siteName,
            type: 'general',
            kioskConfig: {
                apkPath: apkPath,
                devices: ips.map(ip => ({ ip: ip })) // mapping to shared structure
            }
        };
        await SaveSitePreset(preset);
        await loadPresets();
        alert('Preset saved!');
    };

    const handleSelectPreset = (id) => {
        setSelectedPresetId(id);
        const preset = presets.find(p => p.id === id);
        if (preset) {
            setSiteName(preset.siteName);
            setApkPath(preset.kioskConfig.apkPath);
            setIps(preset.kioskConfig.devices.map(d => d.ip));
        } else {
            setSiteName('');
            setApkPath('');
            setIps([]);
        }
    };

    const handleBrowseAPK = async () => {
        const path = await BrowseAPKFile();
        if (path) setApkPath(path);
    };

    const handleAddIp = () => {
        if (newIp && !ips.includes(newIp)) {
            setIps([...ips, newIp]);
            setNewIp('');
        }
    };

    const handleDeploy = async () => {
        if (ips.length === 0 || !apkPath) {
            alert('Please select APK and add at least one IP.');
            return;
        }
        setIsDeploying(true);
        setProgress(0);
        setStatus('🚀 Starting Deployment...');
        try {
            await DeployGenericAPK({ apkPath, ips });
        } catch (e) {
            setStatus(prev => prev + '\n❌ Error: ' + e);
        }
        setIsDeploying(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">General App Installer</h2>
                    <p className="text-xs text-gray-500 mt-1">Universal APK installation for any Android device via ADB WiFi</p>
                </div>

                <div className="flex items-center gap-2">
                    <select 
                        className="bg-[#0d1117] border border-gray-800 rounded px-3 py-1.5 text-xs text-orange-400 font-bold"
                        value={selectedPresetId}
                        onChange={(e) => handleSelectPreset(e.target.value)}
                    >
                        <option value="">-- Load Preset --</option>
                        {presets.map(p => <option key={p.id} value={p.id}>{p.siteName}</option>)}
                    </select>
                    <input 
                        className="bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-xs w-32 text-white"
                        placeholder="Site Name..."
                        value={siteName}
                        onChange={(e) => setSiteName(e.target.value)}
                    />
                    <button onClick={handleSavePreset} className="bg-orange-600 hover:bg-orange-500 p-2 rounded text-white shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    {/* APK Selection */}
                    <div className="bg-[#161b22] border border-gray-800 rounded-lg p-5">
                        <h2 className="text-orange-400 text-xs font-bold uppercase mb-4 tracking-widest">Select APK File</h2>
                        <div className="space-y-3">
                            <div className="bg-[#0d1117] border border-gray-800 rounded p-2 text-[10px] text-gray-400 break-all min-h-[40px]">
                                {apkPath || 'No APK selected'}
                            </div>
                            <button onClick={handleBrowseAPK} className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-xs font-bold transition-colors">
                                Browse File
                            </button>
                        </div>
                    </div>

                    {/* Device IPs */}
                    <div className="bg-[#161b22] border border-gray-800 rounded-lg p-5">
                        <h2 className="text-orange-400 text-xs font-bold uppercase mb-4 tracking-widest">Target Devices (IP:Port)</h2>
                        <div className="flex gap-2 mb-4">
                            <input
                                className="flex-1 bg-[#0d1117] border border-gray-800 rounded px-2 py-1.5 text-xs text-white"
                                placeholder="192.168.1.50:5555"
                                value={newIp}
                                onChange={e => setNewIp(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddIp()}
                            />
                            <button onClick={handleAddIp} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded text-xs font-bold">+</button>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {ips.map(ip => (
                                <div key={ip} className="flex justify-between items-center bg-[#0d1117] border border-gray-800 p-2 rounded text-xs text-gray-300 group">
                                    <span>{ip}</span>
                                    <button onClick={() => setIps(ips.filter(i => i !== ip))} className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                                </div>
                            ))}
                            {ips.length === 0 && <div className="text-xs text-gray-600 text-center py-4">No devices added.</div>}
                        </div>
                    </div>

                    <button
                        onClick={handleDeploy}
                        disabled={isDeploying || ips.length === 0 || !apkPath}
                        className={`w-full py-4 rounded-xl text-sm font-bold shadow-xl transition-all ${isDeploying || ips.length === 0 || !apkPath ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white transform hover:-translate-y-1'}`}
                    >
                        {isDeploying ? '🚀 DEPLOYING...' : '🚀 START DEPLOYMENT'}
                    </button>
                    
                    <div className="bg-orange-900/10 border border-orange-900/30 rounded-lg p-4 text-[10px] text-orange-200/60 leading-relaxed">
                        <p className="font-bold mb-1 text-orange-400">Swan1 Wireless Debugging Tip:</p>
                        1. Settings &gt; About &gt; Build Number (Tap 7 times)<br/>
                        2. Developer Options &gt; Wireless Debugging (On)<br/>
                        3. Use the IP and Port shown there.
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <div className="bg-[#090c10] border border-gray-800 rounded-lg p-5 h-[70vh] flex flex-col">
                        <h2 className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">Deployment Log</h2>
                        {isDeploying && (
                            <div className="mb-4">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-orange-400">Overall Progress</span>
                                    <span className="text-orange-400">{progress}%</span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-2">
                                    <div className="bg-orange-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        )}
                        <pre className="text-[11px] text-orange-300/80 font-mono whitespace-pre-wrap leading-5 flex-1 overflow-y-auto bg-black/40 p-4 rounded border border-gray-800/50">
                            {status || 'Ready for action...'}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default GeneralAppDeploy;
