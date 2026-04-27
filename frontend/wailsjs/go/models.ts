export namespace main {
	
	export class HikCamera {
	    ip: string;
	    username: string;
	    password: string;
	    type: string;
	    gateNo: string;
	
	    static createFrom(source: any = {}) {
	        return new HikCamera(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ip = source["ip"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.type = source["type"];
	        this.gateNo = source["gateNo"];
	    }
	}
	export class HikvisionConfig {
	    targetIp: string;
	    targetPort: string;
	    cameras: HikCamera[];
	
	    static createFrom(source: any = {}) {
	        return new HikvisionConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.targetIp = source["targetIp"];
	        this.targetPort = source["targetPort"];
	        this.cameras = this.convertValues(source["cameras"], HikCamera);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class KioskDevice {
	    ip: string;
	    deviceName: string;
	    gateNo: string;
	    plcIp: string;
	
	    static createFrom(source: any = {}) {
	        return new KioskDevice(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ip = source["ip"];
	        this.deviceName = source["deviceName"];
	        this.gateNo = source["gateNo"];
	        this.plcIp = source["plcIp"];
	    }
	}
	export class KioskDeployConfig {
	    apkPath: string;
	    devices: KioskDevice[];
	    parkingCode: string;
	    paymentTicket: string;
	    serverUrl: string;
	    localServerUrl: string;
	    vehicleMode: string;
	    isSpecialEntrance: boolean;
	    paymentApiVersion: string;
	    apiMode: string;
	    screenTimeoutSec: number;
	    zoningMode: string;
	    zoningCode: string;
	    zoningGateNo: string;
	
	    static createFrom(source: any = {}) {
	        return new KioskDeployConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.apkPath = source["apkPath"];
	        this.devices = this.convertValues(source["devices"], KioskDevice);
	        this.parkingCode = source["parkingCode"];
	        this.paymentTicket = source["paymentTicket"];
	        this.serverUrl = source["serverUrl"];
	        this.localServerUrl = source["localServerUrl"];
	        this.vehicleMode = source["vehicleMode"];
	        this.isSpecialEntrance = source["isSpecialEntrance"];
	        this.paymentApiVersion = source["paymentApiVersion"];
	        this.apiMode = source["apiMode"];
	        this.screenTimeoutSec = source["screenTimeoutSec"];
	        this.zoningMode = source["zoningMode"];
	        this.zoningCode = source["zoningCode"];
	        this.zoningGateNo = source["zoningGateNo"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

