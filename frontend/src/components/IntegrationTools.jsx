import React, { useState } from 'react';
import { SendMockCameraEvent } from '../../wailsjs/go/main/App';

const mockEndpointByDirection = {
    entrance: '/api/v2-202402/order/verify-member',
    exit: '/api/v2-202402/order/verify-license-plate-out',
};

function buildMockTargetUrl(localServerUrl, direction, gateNo) {
    const baseUrl = localServerUrl.trim().replace(/\/+$/, '');
    const endpoint = mockEndpointByDirection[direction];
    return `${baseUrl}${endpoint}?gate_no=${encodeURIComponent(gateNo.trim())}`;
}

function IntegrationTools() {
    const [localServerUrl, setLocalServerUrl] = useState('http://172.20.9.2:8000');
    const [mockDirection, setMockDirection] = useState('entrance');
    const [gateNo, setGateNo] = useState('1');
    const [mockLicensePlate, setMockLicensePlate] = useState('กก0001');
    const [mockResponse, setMockResponse] = useState('');
    const [isMocking, setIsMocking] = useState(false);

    const targetUrl = buildMockTargetUrl(localServerUrl, mockDirection, gateNo);
    const canSend = Boolean(localServerUrl.trim() && gateNo.trim() && mockLicensePlate.trim() && !isMocking);

    const handleSendMockEvent = async () => {
        if (!canSend) {
            alert('Please fill in Local Server URL, Gate No, and License Plate.');
            return;
        }

        setIsMocking(true);
        setMockResponse(`Sending request...\n\nPOST ${targetUrl}`);
        try {
            const result = await SendMockCameraEvent(targetUrl, mockLicensePlate);
            setMockResponse(result);
        } catch (e) {
            setMockResponse('Error: ' + e);
        }
        setIsMocking(false);
    };

    return (
        <>
            <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Integration Tools</h2>
                    <p className="text-xs text-gray-500 mt-1">Mock camera events and simulate payloads to local proxy API</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="bg-[#161b22] border border-gray-800 rounded-lg p-5">
                        <h2 className="text-blue-400 text-xs font-bold uppercase mb-4 tracking-tighter">Mock LPR Camera Event (Multipart Form)</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Local Server URL</label>
                                <input
                                    className="w-full bg-[#0d1117] border border-gray-800 rounded px-3 py-2 text-sm text-white"
                                    value={localServerUrl}
                                    onChange={(e) => setLocalServerUrl(e.target.value)}
                                    placeholder="http://172.20.9.2:8000"
                                />
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Direction</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setMockDirection('entrance')}
                                        className={`py-2 rounded border text-xs font-bold transition-all ${mockDirection === 'entrance' ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-[#0d1117] border-gray-800 text-gray-400 hover:text-gray-200'}`}
                                    >
                                        Entrance
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMockDirection('exit')}
                                        className={`py-2 rounded border text-xs font-bold transition-all ${mockDirection === 'exit' ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-[#0d1117] border-gray-800 text-gray-400 hover:text-gray-200'}`}
                                    >
                                        Exit
                                    </button>
                                </div>
                                <div className="mt-2 text-[10px] text-gray-500 font-mono break-all">
                                    {mockEndpointByDirection[mockDirection]}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Gate No</label>
                                <input
                                    className="w-full bg-[#0d1117] border border-gray-800 rounded px-3 py-2 text-sm text-white font-mono"
                                    value={gateNo}
                                    onChange={(e) => setGateNo(e.target.value)}
                                    placeholder="1"
                                />
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 block mb-1">License Plate (e.g. กก0001)</label>
                                <input
                                    className="w-full bg-[#0d1117] border border-gray-800 rounded px-3 py-2 text-sm text-white font-mono"
                                    value={mockLicensePlate}
                                    onChange={(e) => setMockLicensePlate(e.target.value)}
                                    placeholder="กก0001"
                                />
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Target Endpoint URL</label>
                                <input
                                    className="w-full bg-[#090c10] border border-gray-800 rounded px-3 py-2 text-xs text-gray-400 font-mono"
                                    value={targetUrl}
                                    readOnly
                                />
                            </div>

                            <div className="bg-[#090c10] border border-gray-800 rounded-lg p-3 mt-4 text-xs text-gray-400">
                                <p className="mb-2"><strong className="text-gray-300">Note:</strong> This tool will:</p>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li>Use <code>.promptpark-tool/mock_images/anpr.xml</code> and update plate and UUID before sending.</li>
                                    <li>Include mock <code>detectionPicture.jpg</code> and <code>licensePlatePicture.jpg</code>.</li>
                                    <li>Send as <code>multipart/form-data</code> to the selected endpoint.</li>
                                </ul>
                            </div>

                            <button
                                onClick={handleSendMockEvent}
                                disabled={!canSend}
                                className={`w-full py-3 mt-4 rounded-md text-sm font-bold transition-all ${!canSend ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                            >
                                {isMocking ? 'Sending...' : 'Send Mock Event'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-[#090c10] border border-gray-800 rounded-lg p-5 h-[65vh] flex flex-col">
                    <h2 className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">Response Detail</h2>
                    <pre className="text-[11px] text-green-400 font-mono whitespace-pre-wrap leading-5 flex-1 overflow-y-auto bg-black/50 p-4 rounded border border-gray-800/50 break-all text-left">
                        {mockResponse || 'Awaiting request...'}
                    </pre>
                </div>
            </div>
        </>
    );
}

export default IntegrationTools;
