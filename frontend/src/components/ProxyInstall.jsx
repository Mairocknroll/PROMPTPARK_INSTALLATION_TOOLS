import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    CheckPortInUse,
    CheckSSHConnection,
    DeleteInstallationProfile,
    DeployToServer,
    ListDeploymentHistory,
    ListInstallationProfiles,
    ReadRemoteEnv,
    RedeployProxy,
    RestoreLatestProxyEnvBackup,
    RunProxyHealthCheck,
    RunServerPreflight,
    SaveEnvConfig,
    SaveInstallationProfile,
    SaveRemoteEnv,
    StartProxyLogs,
    StopProxyLogs,
    ValidateProxyEnv
} from '../../wailsjs/go/main/App';
import { EventsOff, EventsOn } from '../../wailsjs/runtime/runtime';

const emptySystem = {
    SERVER_URL: 'https://api-pms.jparkdev.co',
    PARKING_CODE: '',
    ADDR: '0.0.0.0:8000',
    CAMERA_USER: 'admin',
    CAMERA_PASS: '',
    MODBUS_PORT: '504',
    MODBUS_TIMEOUT_MS: '2000',
    MODBUS_PULSE_MS: '500',
    MODBUS_SLAVE_ID: '1'
};

const emptyServer = {
    ip: '',
    username: 'jpark',
    password: '',
    targetPath: '/home/jpark/go_local_proxy_api'
};

const makeSite = () => ({
    id: String(Date.now()),
    name: '',
    system: { ...emptySystem },
    lanes: [],
    serverConfig: { ...emptyServer },
    status: {
        lastDeployAt: '',
        lastDeployStatus: 'draft',
        lastHealthcheckAt: '',
        lastHealthcheckStatus: ''
    }
});

const normalizeSite = (profile) => {
    const data = profile?.data || {};
    return {
        id: data.id || profile?.name || String(Date.now()),
        name: data.name || profile?.name || 'Untitled Site',
        system: { ...emptySystem, ...(data.system || {}) },
        lanes: Array.isArray(data.lanes) ? data.lanes : [],
        serverConfig: { ...emptyServer, ...(data.serverConfig || {}), password: '' },
        status: { lastDeployStatus: 'draft', ...(data.status || {}) }
    };
};

const siteToProfile = (site) => ({
    name: site.name,
    data: {
        ...site,
        system: { ...site.system },
        serverConfig: { ...site.serverConfig, password: '' }
    }
});

const buildEnv = (system, lanes) => {
    const lines = [];
    Object.entries(system).forEach(([key, value]) => {
        if (key === 'CAMERA_USER') lines.push('');
        lines.push(`${key}=${value || ''}`);
    });
    lanes.forEach((lane) => {
        const suffix = lane.number;
        const io = lane.type === 'ENT' ? 'IN' : 'OUT';
        lines.push(`\n# --- ${lane.type}-${suffix} ---`);
        lines.push(`${lane.type}_GATE_${suffix}=${lane.gateIp || ''}`);
        lines.push(`LPR_${io}_${suffix}=${lane.lprIp || ''}`);
        lines.push(`LIC_${io}_${suffix}=${lane.licIp || ''}`);
        lines.push(`DRI_${io}_${suffix}=${lane.driIp || ''}`);
        if (lane.hasLed) lines.push(`HIK_LED_MAIN_${lane.type}_${suffix}=${lane.ledIp || ''}`);
        lines.push(`# --- ${lane.type}-${suffix} ---`);
    });
    return lines.join('\n');
};

const parseEnv = (envString, baseSystem) => {
    const nextSystem = { ...baseSystem };
    const lanes = [];
    const ensureLane = (type, number, gateIp = '') => {
        let lane = lanes.find((item) => item.type === type && item.number === number);
        if (!lane) {
            lane = { id: `${type}-${number}-${Date.now()}`, type, number, gateIp, lprIp: '', licIp: '', driIp: '', hasLed: false, ledIp: '' };
            lanes.push(lane);
        }
        if (gateIp) lane.gateIp = gateIp;
        return lane;
    };

    envString.split('\n').forEach((raw) => {
        const line = raw.trim();
        if (!line || line.startsWith('#')) return;
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=');
        if (key in nextSystem) {
            nextSystem[key] = value;
            return;
        }
        const gate = key.match(/^(ENT|EXT)_GATE_(\d+)$/);
        if (gate) {
            ensureLane(gate[1], gate[2], value);
            return;
        }
        const device = key.match(/^(LPR|LIC|DRI|HIK_LED_MAIN)_(IN|OUT|ENT|EXT)_(\d+)$/);
        if (!device) return;
        const type = device[2] === 'IN' || device[2] === 'ENT' ? 'ENT' : 'EXT';
        const lane = ensureLane(type, device[3]);
        if (device[1] === 'LPR') lane.lprIp = value;
        if (device[1] === 'LIC') lane.licIp = value;
        if (device[1] === 'DRI') lane.driIp = value;
        if (device[1] === 'HIK_LED_MAIN') {
            lane.hasLed = true;
            lane.ledIp = value;
        }
    });
    return { system: nextSystem, lanes };
};

function ProxyInstall() {
    const [view, setView] = useState('list');
    const [wizardStep, setWizardStep] = useState(1);
    const [activeTab, setActiveTab] = useState('overview');
    const [sites, setSites] = useState([]);
    const [selected, setSelected] = useState(null);
    const [draft, setDraft] = useState(makeSite());
    const [laneDraft, setLaneDraft] = useState({ type: 'ENT', number: '01', gateIp: '', lprIp: '', licIp: '', driIp: '', hasLed: false, ledIp: '' });
    const [validation, setValidation] = useState(null);
    const [preflight, setPreflight] = useState([]);
    const [history, setHistory] = useState([]);
    const [statusLog, setStatusLog] = useState('');
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [loadRemote, setLoadRemote] = useState({
        name: '',
        ip: '172.20.9.2',
        username: 'jpark',
        password: '',
        targetPath: '/home/jpark/go_local_proxy_api'
    });
    const [isLoadingRemote, setIsLoadingRemote] = useState(false);
    const logsEndRef = useRef(null);

    const current = view === 'detail' ? selected : draft;
    const envContent = useMemo(() => buildEnv(current.system, current.lanes), [current]);

    const refreshSites = async () => {
        const profiles = await ListInstallationProfiles().catch(() => []);
        setSites((Array.isArray(profiles) ? profiles : []).map(normalizeSite));
        const deployHistory = await ListDeploymentHistory().catch(() => []);
        setHistory(Array.isArray(deployHistory) ? deployHistory : []);
    };

    useEffect(() => {
        refreshSites();
    }, []);

    useEffect(() => {
        ValidateProxyEnv(envContent).then(setValidation).catch(() => setValidation(null));
    }, [envContent]);

    useEffect(() => {
        EventsOn('deploy-progress', (data) => {
            setProgress(data.progress);
            setStatusLog((prev) => `${prev}\n[${data.progress}%] ${data.message}`);
        });
        EventsOn('proxy-log-line', (data) => {
            setLogs((prev) => `${prev}\n${data.message}`);
        });
        return () => {
            EventsOff('deploy-progress');
            EventsOff('proxy-log-line');
            StopProxyLogs().catch(() => {});
        };
    }, []);

    useEffect(() => {
        if (logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const updateCurrent = (patch) => {
        if (view === 'detail') {
            setSelected((prev) => ({ ...prev, ...patch }));
        } else {
            setDraft((prev) => ({ ...prev, ...patch }));
        }
    };

    const updateSystem = (key, value) => updateCurrent({ system: { ...current.system, [key]: value } });
    const updateServer = (key, value) => updateCurrent({ serverConfig: { ...current.serverConfig, [key]: value } });

    const saveSite = async (site = current) => {
        if (!site.name.trim()) {
            alert('Site nickname is required.');
            return false;
        }
        await SaveInstallationProfile(siteToProfile(site));
        await refreshSites();
        return true;
    };

    const promptSSHCredentials = (site) => {
        const username = window.prompt('SSH Username', site.serverConfig.username || 'jpark');
        if (!username) return null;
        const password = window.prompt(`SSH Password for ${username}@${site.serverConfig.ip}`);
        if (password === null) return null;
        return {
            ...site,
            serverConfig: {
                ...site.serverConfig,
                username,
                password
            }
        };
    };

    const ensureSSHCredentials = () => {
        if (current.serverConfig.username && current.serverConfig.password) return current;
        const withCredentials = promptSSHCredentials(current);
        if (!withCredentials) return null;
        updateCurrent(withCredentials);
        return withCredentials;
    };

    const openSite = (site, tab = 'overview') => {
        setSelected(site);
        setActiveTab(tab);
        setView('detail');
        setStatusLog('');
        setPreflight([]);
    };

    const openSiteWithSSH = async (site, tab = 'overview') => {
        const withCredentials = promptSSHCredentials(site);
        if (!withCredentials) return;
        setStatusLog('Loading remote .env...');
        try {
            const remoteEnv = await ReadRemoteEnv(
                withCredentials.serverConfig.ip,
                withCredentials.serverConfig.username,
                withCredentials.serverConfig.password,
                withCredentials.serverConfig.targetPath
            );
            const parsed = parseEnv(remoteEnv, { ...withCredentials.system });
            const hydratedSite = {
                ...withCredentials,
                system: parsed.system,
                lanes: parsed.lanes.length ? parsed.lanes : withCredentials.lanes
            };
            await SaveInstallationProfile(siteToProfile(hydratedSite));
            await refreshSites();
            openSite(hydratedSite, tab);
            setStatusLog(`Loaded .env from ${withCredentials.serverConfig.ip}:${withCredentials.serverConfig.targetPath}`);
        } catch (e) {
            openSite(withCredentials, tab);
            setStatusLog(`Opened site, but remote .env could not be loaded: ${e}`);
        }
    };

    const deleteSite = async (site) => {
        if (!window.confirm(`Delete "${site.name}" from this tool only? This will not remove anything on the server.`)) return;
        await DeleteInstallationProfile(site.name);
        await refreshSites();
        if (selected?.name === site.name) {
            setSelected(null);
            setView('list');
        }
    };

    const startNew = () => {
        setDraft(makeSite());
        setLaneDraft({ type: 'ENT', number: '01', gateIp: '', lprIp: '', licIp: '', driIp: '', hasLed: false, ledIp: '' });
        setWizardStep(1);
        setView('wizard');
        setStatusLog('');
        setPreflight([]);
    };

    const loadExistingProxy = async () => {
        if (!loadRemote.ip || !loadRemote.username || !loadRemote.password || !loadRemote.targetPath) {
            alert('Server IP, username, password and target path are required.');
            return;
        }
        setIsLoadingRemote(true);
        setStatusLog('Loading remote .env...');
        try {
            const sshResult = await CheckSSHConnection(loadRemote.ip, loadRemote.username, loadRemote.password);
            if (sshResult !== 'Success') {
                alert(`SSH connection failed: ${sshResult}`);
                return;
            }
            const remoteEnv = await ReadRemoteEnv(loadRemote.ip, loadRemote.username, loadRemote.password, loadRemote.targetPath);
            const parsed = parseEnv(remoteEnv, { ...emptySystem });
            const siteName = loadRemote.name.trim() || parsed.system.PARKING_CODE || loadRemote.ip;
            const loadedSite = {
                id: `${siteName}-${Date.now()}`,
                name: siteName,
                system: parsed.system,
                lanes: parsed.lanes,
                serverConfig: {
                    ip: loadRemote.ip,
                    username: loadRemote.username,
                    password: loadRemote.password,
                    targetPath: loadRemote.targetPath
                },
                status: {
                    lastDeployAt: '',
                    lastDeployStatus: 'loaded',
                    lastHealthcheckAt: '',
                    lastHealthcheckStatus: ''
                }
            };
            await SaveInstallationProfile(siteToProfile(loadedSite));
            await refreshSites();
            setSelected(loadedSite);
            setActiveTab('config');
            setView('detail');
            setStatusLog(`Loaded .env from ${loadRemote.ip}:${loadRemote.targetPath}`);
        } catch (e) {
            setStatusLog(`Load failed: ${e}`);
            alert(`Load failed: ${e}`);
        } finally {
            setIsLoadingRemote(false);
        }
    };

    const addLane = () => {
        if (!laneDraft.gateIp) {
            alert('Gate IP is required.');
            return;
        }
        const lane = { ...laneDraft, id: `${laneDraft.type}-${laneDraft.number}-${Date.now()}` };
        updateCurrent({ lanes: [...current.lanes, lane] });
        const nextNo = String((parseInt(laneDraft.number, 10) || current.lanes.length + 1) + 1).padStart(2, '0');
        setLaneDraft({ type: laneDraft.type, number: nextNo, gateIp: '', lprIp: '', licIp: '', driIp: '', hasLed: false, ledIp: '' });
    };

    const removeLane = (id) => updateCurrent({ lanes: current.lanes.filter((lane) => lane.id !== id) });

    const autoFillLane = () => {
        const parts = laneDraft.gateIp.split('.');
        if (parts.length !== 4) return;
        const last = parseInt(parts[3], 10);
        if (Number.isNaN(last)) return;
        const prefix = parts.slice(0, 3).join('.');
        setLaneDraft((prev) => ({
            ...prev,
            lprIp: prev.lprIp || `${prefix}.${last + 20}`,
            licIp: prev.licIp || `${prefix}.${last + 30}`,
            driIp: prev.driIp || `${prefix}.${last + 40}`
        }));
    };

    const runPreflight = async () => {
        const site = ensureSSHCredentials();
        if (!site) return;
        const server = site.serverConfig;
        if (!server.ip || !server.username || !server.password || !server.targetPath) {
            alert('Server IP, username, password and target path are required.');
            return;
        }
        setStatusLog('Running preflight checks...');
        const checks = await RunServerPreflight(server.ip, server.username, server.password, server.targetPath, current.system.SERVER_URL, 8000);
        setPreflight(Array.isArray(checks) ? checks : []);
        setStatusLog((Array.isArray(checks) ? checks : []).map((check) => `${check.ok ? 'OK' : 'FAIL'} ${check.name}: ${check.message}${check.detail ? ` (${check.detail})` : ''}`).join('\n'));
    };

    const healthcheck = async () => {
        if (!current.serverConfig.ip) {
            alert('Server IP is required.');
            return;
        }
        const report = await RunProxyHealthCheck(current.serverConfig.ip, 8000);
        const next = {
            ...current,
            status: {
                ...current.status,
                lastHealthcheckAt: new Date().toISOString(),
                lastHealthcheckStatus: report.ok ? 'ok' : 'failed'
            }
        };
        updateCurrent(next);
        setStatusLog(report.ok ? 'Healthcheck OK: /healthz returned 200' : `Healthcheck failed: ${(report.issues || []).map((item) => `${item.field} ${item.message}`).join(', ')}`);
    };

    const deploy = async () => {
        if (!validation?.ok) {
            alert('Fix validation errors before deploy.');
            return;
        }
        const site = ensureSSHCredentials();
        if (!site) return;
        const server = site.serverConfig;
        if (!server.ip || !server.username || !server.password || !server.targetPath) {
            alert('Server IP, username, password and target path are required.');
            return;
        }
        const sshResult = await CheckSSHConnection(server.ip, server.username, server.password);
        if (sshResult !== 'Success') {
            alert(`SSH connection failed: ${sshResult}`);
            return;
        }
        const portInUse = await CheckPortInUse(server.ip, server.username, server.password, 8000);
        if (portInUse && !window.confirm('Port 8000 is already in use. Continue deploy anyway?')) return;

        setStatusLog('Starting deployment...');
        setProgress(0);
        const result = await DeployToServer(server.ip, server.username, server.password, server.targetPath, envContent);
        const next = {
            ...site,
            status: {
                ...site.status,
                lastDeployAt: new Date().toISOString(),
                lastDeployStatus: result.startsWith('Deployed successfully') ? 'success' : 'failed'
            }
        };
        updateCurrent(next);
        await SaveInstallationProfile(siteToProfile(next));
        await refreshSites();
        setStatusLog((prev) => `${prev}\n${result}`);
    };

    const saveRemoteEnv = async () => {
        const site = ensureSSHCredentials();
        if (!site) return;
        const server = site.serverConfig;
        await SaveRemoteEnv(server.ip, server.username, server.password, server.targetPath, envContent);
        setStatusLog('Remote .env saved. A backup was created before writing.');
    };

    const redeploy = async () => {
        const site = ensureSSHCredentials();
        if (!site) return;
        const server = site.serverConfig;
        await SaveRemoteEnv(server.ip, server.username, server.password, server.targetPath, envContent);
        await RedeployProxy(server.ip, server.username, server.password, server.targetPath);
        setStatusLog('Remote .env saved and docker compose restarted.');
    };

    const rollback = async () => {
        if (!window.confirm('Restore latest remote .env backup and restart docker compose?')) return;
        const site = ensureSSHCredentials();
        if (!site) return;
        const server = site.serverConfig;
        await RestoreLatestProxyEnvBackup(server.ip, server.username, server.password, server.targetPath);
        setStatusLog('Rollback completed.');
    };

    const readRemoteEnv = async () => {
        const site = ensureSSHCredentials();
        if (!site) return;
        const server = site.serverConfig;
        const remoteEnv = await ReadRemoteEnv(server.ip, server.username, server.password, server.targetPath);
        const parsed = parseEnv(remoteEnv, site.system);
        updateCurrent({ system: parsed.system, lanes: parsed.lanes });
        setStatusLog('Remote .env loaded into this site.');
    };

    const startLogs = async () => {
        const site = ensureSSHCredentials();
        if (!site) return;
        const server = site.serverConfig;
        setLogs('Connecting to docker logs...');
        setStreaming(true);
        await StartProxyLogs(server.ip, server.username, server.password, server.targetPath);
    };

    const stopLogs = async () => {
        await StopProxyLogs();
        setStreaming(false);
    };

    const siteCounts = (site) => ({
        ent: site.lanes.filter((lane) => lane.type === 'ENT').length,
        ext: site.lanes.filter((lane) => lane.type === 'EXT').length
    });

    const renderStatusBadge = (status) => {
        const color = status === 'success' ? 'bg-green-900 text-green-300' : status === 'failed' ? 'bg-red-900 text-red-300' : 'bg-gray-800 text-gray-400';
        return <span className={`text-[10px] px-2 py-0.5 rounded ${color}`}>{status || 'draft'}</span>;
    };

    const SiteList = () => (
        <>
            <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white">Local Proxy Sites</h2>
                    <p className="text-xs text-gray-500 mt-1">Select an installed site or create a new local proxy installation.</p>
                </div>
                <button onClick={startNew} title="New install" className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-2xl leading-none flex items-center justify-center">+</button>
            </div>

            <div className="bg-[#161b22] border border-gray-800 rounded-lg p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-sm font-bold text-white">Load Existing Proxy</h3>
                        <p className="text-xs text-gray-500 mt-1">Connect to an installed server, read remote .env, and save it as a site profile.</p>
                    </div>
                    <button onClick={loadExistingProxy} disabled={isLoadingRemote} className={`px-4 py-2 rounded text-xs font-bold ${isLoadingRemote ? 'bg-gray-700 text-gray-500' : 'bg-green-600 hover:bg-green-500 text-white'}`}>
                        {isLoadingRemote ? 'Loading...' : 'Load'}
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <input className="bg-[#0d1117] border border-gray-800 rounded px-3 py-2 text-sm" value={loadRemote.name} onChange={(e) => setLoadRemote({ ...loadRemote, name: e.target.value })} placeholder="Site nickname (optional)" />
                    <input className="bg-[#0d1117] border border-gray-800 rounded px-3 py-2 text-sm" value={loadRemote.ip} onChange={(e) => setLoadRemote({ ...loadRemote, ip: e.target.value })} placeholder="172.20.9.2" />
                    <input className="bg-[#0d1117] border border-gray-800 rounded px-3 py-2 text-sm" value={loadRemote.username} onChange={(e) => setLoadRemote({ ...loadRemote, username: e.target.value })} placeholder="username" />
                    <input type="password" className="bg-[#0d1117] border border-gray-800 rounded px-3 py-2 text-sm" value={loadRemote.password} onChange={(e) => setLoadRemote({ ...loadRemote, password: e.target.value })} placeholder="password" />
                    <input className="bg-[#0d1117] border border-gray-800 rounded px-3 py-2 text-sm" value={loadRemote.targetPath} onChange={(e) => setLoadRemote({ ...loadRemote, targetPath: e.target.value })} placeholder="/home/jpark/go_local_proxy_api" />
                </div>
            </div>

            {sites.length === 0 ? (
                <div className="border border-dashed border-gray-700 rounded-lg p-10 text-center bg-[#090c10]">
                    <div className="text-gray-300 text-sm">No sites saved yet.</div>
                    <button onClick={startNew} className="mt-4 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-bold">Create First Site</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sites.map((site) => {
                        const counts = siteCounts(site);
                        return (
                            <div key={site.id} className="bg-[#161b22] border border-gray-800 rounded-lg p-5">
                                <div className="flex justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-white">{site.name}</h3>
                                        <div className="text-xs text-gray-500 mt-1">{site.system.PARKING_CODE || 'No parking code'}</div>
                                    </div>
                                    {renderStatusBadge(site.status?.lastDeployStatus)}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 mt-4">
                                    <div><span className="text-gray-600">Server</span><br />{site.serverConfig.ip || '-'}</div>
                                    <div><span className="text-gray-600">Lanes</span><br />{counts.ent} Entrance / {counts.ext} Exit</div>
                                    <div className="col-span-2"><span className="text-gray-600">Last deploy</span><br />{site.status?.lastDeployAt || 'Not deployed'}</div>
                                </div>
                                <div className="flex gap-2 mt-5">
                                    <button onClick={() => openSiteWithSSH(site)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold">Open</button>
                                    <button onClick={() => openSiteWithSSH(site, 'logs')} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-xs">Logs</button>
                                    <button onClick={() => deleteSite(site)} className="ml-auto text-red-400 hover:text-red-300 px-2 py-1.5 text-xs">Delete</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );

    const LaneEditor = () => (
        <div className="space-y-4">
            <div className="bg-[#161b22] border border-gray-800 rounded-lg p-4">
                <h3 className="text-xs text-blue-400 font-bold uppercase mb-3">Add Lane</h3>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    <select className="bg-[#0d1117] border border-gray-800 rounded px-2 py-2 text-sm" value={laneDraft.type} onChange={(e) => setLaneDraft({ ...laneDraft, type: e.target.value })}>
                        <option value="ENT">Entrance</option>
                        <option value="EXT">Exit</option>
                    </select>
                    <input className="bg-[#0d1117] border border-gray-800 rounded px-2 py-2 text-sm" value={laneDraft.number} onChange={(e) => setLaneDraft({ ...laneDraft, number: e.target.value })} placeholder="01" />
                    <input className="md:col-span-2 bg-[#0d1117] border border-gray-800 rounded px-2 py-2 text-sm" value={laneDraft.gateIp} onBlur={autoFillLane} onChange={(e) => setLaneDraft({ ...laneDraft, gateIp: e.target.value })} placeholder="Gate IP" />
                    <button onClick={addLane} className="md:col-span-2 bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-2 text-sm font-bold">Add Lane</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                    <input className="bg-[#0d1117] border border-gray-800 rounded px-2 py-2 text-xs" value={laneDraft.lprIp} onChange={(e) => setLaneDraft({ ...laneDraft, lprIp: e.target.value })} placeholder="LPR IP" />
                    <input className="bg-[#0d1117] border border-gray-800 rounded px-2 py-2 text-xs" value={laneDraft.licIp} onChange={(e) => setLaneDraft({ ...laneDraft, licIp: e.target.value })} placeholder="LIC IP" />
                    <input className="bg-[#0d1117] border border-gray-800 rounded px-2 py-2 text-xs" value={laneDraft.driIp} onChange={(e) => setLaneDraft({ ...laneDraft, driIp: e.target.value })} placeholder="DRI IP" />
                    <label className="flex items-center gap-2 text-xs text-gray-400">
                        <input type="checkbox" checked={laneDraft.hasLed} onChange={(e) => setLaneDraft({ ...laneDraft, hasLed: e.target.checked })} />
                        LED
                    </label>
                    {laneDraft.hasLed && <input className="md:col-span-4 bg-[#0d1117] border border-gray-800 rounded px-2 py-2 text-xs" value={laneDraft.ledIp} onChange={(e) => setLaneDraft({ ...laneDraft, ledIp: e.target.value })} placeholder="LED IP" />}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {current.lanes.map((lane) => (
                    <div key={lane.id} className="bg-[#161b22] border border-gray-800 rounded-lg p-4">
                        <div className="flex justify-between">
                            <span className={`text-[10px] px-2 py-0.5 rounded ${lane.type === 'ENT' ? 'bg-green-900 text-green-300' : 'bg-orange-900 text-orange-300'}`}>{lane.type} {lane.number}</span>
                            <button onClick={() => removeLane(lane.id)} className="text-red-400 text-xs">Delete</button>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-xs text-gray-400 mt-3">
                            <div>Gate: {lane.gateIp || '-'}</div>
                            <div>LPR: {lane.lprIp || '-'}</div>
                            <div>LIC: {lane.licIp || '-'}</div>
                            <div>DRI: {lane.driIp || '-'}</div>
                            {lane.hasLed && <div className="col-span-2 text-blue-400">LED: {lane.ledIp || '-'}</div>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const ValidationPanel = () => (
        <div className="bg-[#090c10] border border-gray-800 rounded-lg p-4">
            <h3 className="text-[10px] text-gray-500 uppercase mb-3">Validation</h3>
            {validation?.ok ? <div className="text-green-400 text-xs">Ready</div> : (
                <div className="text-red-300 text-xs space-y-1 max-h-40 overflow-y-auto">
                    {(validation?.issues || []).map((issue, idx) => <div key={idx}>{issue.field}: {issue.message}</div>)}
                    {!validation && <div>Waiting for validation...</div>}
                </div>
            )}
            {(validation?.warnings || []).map((warning, idx) => <div key={idx} className="text-yellow-500 text-xs mt-1">{warning.field}: {warning.message}</div>)}
        </div>
    );

    const SiteInfoForm = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Site Nickname" value={current.name} onChange={(v) => updateCurrent({ name: v })} />
            <Field label="Parking Code" value={current.system.PARKING_CODE} onChange={(v) => updateSystem('PARKING_CODE', v)} />
            <Field label="Server URL" value={current.system.SERVER_URL} onChange={(v) => updateSystem('SERVER_URL', v)} />
            <Field label="Camera User" value={current.system.CAMERA_USER} onChange={(v) => updateSystem('CAMERA_USER', v)} />
            <Field label="Camera Password" type="password" value={current.system.CAMERA_PASS} onChange={(v) => updateSystem('CAMERA_PASS', v)} />
            <Field label="Listen Address" value={current.system.ADDR} onChange={(v) => updateSystem('ADDR', v)} />
            <Field label="Modbus Port" value={current.system.MODBUS_PORT} onChange={(v) => updateSystem('MODBUS_PORT', v)} />
            <Field label="Modbus Timeout MS" value={current.system.MODBUS_TIMEOUT_MS} onChange={(v) => updateSystem('MODBUS_TIMEOUT_MS', v)} />
            <Field label="Modbus Pulse MS" value={current.system.MODBUS_PULSE_MS} onChange={(v) => updateSystem('MODBUS_PULSE_MS', v)} />
        </div>
    );

    const ServerConnectionForm = () => (
        <div className="bg-[#161b22] border border-gray-800 rounded-lg p-5">
            <h3 className="text-xs text-blue-400 font-bold uppercase mb-4">Ubuntu Server Connection</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Server IP" value={current.serverConfig.ip} onChange={(v) => updateServer('ip', v)} />
                <Field label="SSH Username" value={current.serverConfig.username} onChange={(v) => updateServer('username', v)} />
                <Field label="SSH Password" type="password" value={current.serverConfig.password} onChange={(v) => updateServer('password', v)} />
                <Field label="Project Path" value={current.serverConfig.targetPath} onChange={(v) => updateServer('targetPath', v)} />
            </div>
        </div>
    );

    const Stepper = () => {
        const steps = ['Site Data', 'Lanes', 'Server Check', 'Deploy', 'Logs'];
        return (
            <div className="grid grid-cols-5 gap-2 mb-6">
                {steps.map((label, idx) => {
                    const step = idx + 1;
                    const active = wizardStep === step;
                    const done = wizardStep > step;
                    return (
                        <button key={label} onClick={() => setWizardStep(step)} className={`text-left border rounded-lg p-3 transition-all ${active ? 'border-blue-500 bg-blue-600/10 text-blue-300' : done ? 'border-green-800 bg-green-950/20 text-green-300' : 'border-gray-800 bg-[#090c10] text-gray-500'}`}>
                            <div className="text-[10px] uppercase">Step {step}</div>
                            <div className="text-xs font-bold mt-1">{label}</div>
                        </button>
                    );
                })}
            </div>
        );
    };

    const Wizard = () => (
        <>
            <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-6">
                <div>
                    <button onClick={() => setView('list')} className="text-xs text-gray-500 hover:text-gray-300 mb-2">Back to sites</button>
                    <h2 className="text-2xl font-bold text-white">New Local Proxy Install</h2>
                    <p className="text-xs text-gray-500 mt-1">Create config, check the Ubuntu host, deploy, then inspect logs.</p>
                </div>
            </div>

            {Stepper()}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-5">
                    {wizardStep === 1 && SiteInfoForm()}
                    {wizardStep === 2 && LaneEditor()}
                    {wizardStep === 3 && (
                        <div className="space-y-4">
                            {ServerConnectionForm()}
                            {ValidationPanel()}
                            <button onClick={runPreflight} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-bold">Run Preflight</button>
                            {PreflightList()}
                        </div>
                    )}
                    {wizardStep === 4 && DeployPanel()}
                    {wizardStep === 5 && LogsTab()}
                    <div className="flex justify-between pt-4">
                        <button onClick={() => setWizardStep(Math.max(1, wizardStep - 1))} disabled={wizardStep === 1} className="bg-gray-700 disabled:bg-gray-900 text-white px-4 py-2 rounded text-sm">Back</button>
                        {wizardStep < 5 ? (
                            <button onClick={() => setWizardStep(wizardStep + 1)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-bold">Next</button>
                        ) : (
                            <button onClick={async () => { if (await saveSite(draft)) openSite(draft); }} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm font-bold">Save Site</button>
                        )}
                    </div>
                </div>
                <div className="space-y-4">
                    {ValidationPanel()}
                    {EnvPreview()}
                </div>
            </div>
        </>
    );

    const PreflightList = () => (
        <div className="space-y-2">
            {preflight.map((check) => (
                <div key={check.name} className="bg-[#161b22] border border-gray-800 rounded p-3 text-xs">
                    <span className={check.ok ? 'text-green-400' : 'text-red-400'}>{check.ok ? 'OK' : 'FAIL'}</span>
                    <span className="text-gray-300 ml-2">{check.name}</span>
                    <div className="text-gray-500 mt-1">{check.message} {check.detail}</div>
                </div>
            ))}
        </div>
    );

    const EnvPreview = () => (
        <div className="bg-[#090c10] border border-gray-800 rounded-lg p-4 max-h-[60vh] overflow-auto">
            <div className="flex justify-between mb-3">
                <h3 className="text-[10px] text-gray-500 uppercase">.env Preview</h3>
                <button onClick={async () => alert(await SaveEnvConfig(envContent))} className="text-[10px] text-blue-400">Save Local</button>
            </div>
            <pre className="text-[11px] text-green-400 whitespace-pre-wrap leading-5">{envContent}</pre>
        </div>
    );

    const DeployPanel = () => (
        <div className="space-y-4">
            {ServerConnectionForm()}
            <div className="flex flex-wrap gap-2">
                <button onClick={deploy} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm font-bold">Deploy</button>
                <button onClick={saveRemoteEnv} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm">Save Remote .env</button>
                <button onClick={redeploy} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm">Redeploy</button>
                <button onClick={rollback} className="bg-yellow-700 hover:bg-yellow-600 text-white px-4 py-2 rounded text-sm">Rollback</button>
            </div>
            {progress > 0 && <div className="w-full bg-gray-800 rounded h-2"><div className="bg-blue-600 h-2 rounded" style={{ width: `${progress}%` }} /></div>}
            <pre className="bg-black border border-gray-800 rounded p-4 text-xs text-gray-300 whitespace-pre-wrap min-h-[220px]">{statusLog || 'No deployment output yet.'}</pre>
        </div>
    );

    const Detail = () => (
        <>
            <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-6">
                <div>
                    <button onClick={() => setView('list')} className="text-xs text-gray-500 hover:text-gray-300 mb-2">Back to sites</button>
                    <h2 className="text-2xl font-bold text-white">{current.name}</h2>
                    <p className="text-xs text-gray-500 mt-1">{current.system.PARKING_CODE || '-'} | Server {current.serverConfig.ip || '-'} | Last deploy: {current.status?.lastDeployStatus || 'draft'}</p>
                </div>
                <button onClick={() => saveSite(current)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-bold">Save Draft</button>
            </div>

            <div className="flex gap-5 border-b border-gray-800 mb-6">
                {['overview', 'config', 'deploy', 'logs', 'history'].map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-2 text-sm font-bold capitalize ${activeTab === tab ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>{tab}</button>
                ))}
            </div>

            {activeTab === 'overview' && Overview()}
            {activeTab === 'config' && ConfigTab()}
            {activeTab === 'deploy' && DeployPanel()}
            {activeTab === 'logs' && LogsTab()}
            {activeTab === 'history' && HistoryTab()}
        </>
    );

    const Overview = () => {
        const counts = siteCounts(current);
        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Summary label="Server" value={current.serverConfig.ip || '-'} />
                    <Summary label="Parking Code" value={current.system.PARKING_CODE || '-'} />
                    <Summary label="Lanes" value={`${counts.ent} Entrance / ${counts.ext} Exit`} />
                    <Summary label="Health" value={current.status?.lastHealthcheckStatus || 'not checked'} />
                </div>
                <div className="space-y-3">
                    <button onClick={healthcheck} className="w-full bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm">Healthcheck</button>
                    <button onClick={runPreflight} className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm">Preflight</button>
                    <button onClick={() => setActiveTab('deploy')} className="w-full bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm font-bold">Deploy</button>
                </div>
            </div>
        );
    };

    const ConfigTab = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-[#161b22] border border-gray-800 rounded-lg p-5">
                    <h3 className="text-xs text-blue-400 font-bold uppercase mb-4">Site Configuration</h3>
                    {SiteInfoForm()}
                </div>
                {LaneEditor()}
                <div className="flex gap-2">
                    <button onClick={readRemoteEnv} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm">Read Remote .env</button>
                    <button onClick={() => saveSite(current)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-bold">Save Draft</button>
                </div>
            </div>
            <div className="space-y-4">
                {ValidationPanel()}
                {EnvPreview()}
            </div>
        </div>
    );

    const LogsTab = () => (
        <div className="space-y-4">
            <div className="flex gap-2">
                {!streaming ? (
                    <button onClick={startLogs} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-bold">Start Logs</button>
                ) : (
                    <button onClick={stopLogs} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded text-sm font-bold">Stop Logs</button>
                )}
                <button onClick={() => setLogs('')} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm">Clear</button>
            </div>
            <pre className="bg-black border border-gray-800 rounded p-4 h-[60vh] overflow-auto text-xs text-gray-300 whitespace-pre-wrap">{logs || 'No logs.'}<span ref={logsEndRef} /></pre>
        </div>
    );

    const HistoryTab = () => (
        <div className="space-y-3">
            {history.length === 0 && <div className="text-sm text-gray-500">No deployment history.</div>}
            {history.map((item, idx) => (
                <div key={`${item.timestamp}-${idx}`} className="bg-[#161b22] border border-gray-800 rounded-lg p-4">
                    <div className="flex justify-between">
                        <div className="text-sm text-white">{item.server} {item.targetPath}</div>
                        {renderStatusBadge(item.status)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{item.timestamp}</div>
                    <div className="text-xs text-gray-400 mt-2">{item.message}</div>
                </div>
            ))}
        </div>
    );

    return (
        <>
            {view === 'list' && SiteList()}
            {view === 'wizard' && Wizard()}
            {view === 'detail' && selected && Detail()}
        </>
    );
}

function Field({ label, value, onChange, type = 'text' }) {
    return (
        <label className="block">
            <span className="text-[10px] text-gray-500 uppercase">{label}</span>
            <input type={type} className="mt-1 w-full bg-[#0d1117] border border-gray-800 rounded px-3 py-2 text-sm" value={value || ''} onChange={(e) => onChange(e.target.value)} />
        </label>
    );
}

function Summary({ label, value }) {
    return (
        <div className="bg-[#161b22] border border-gray-800 rounded-lg p-5">
            <div className="text-[10px] text-gray-500 uppercase mb-2">{label}</div>
            <div className="text-lg text-white font-bold break-all">{value}</div>
        </div>
    );
}

export default ProxyInstall;
