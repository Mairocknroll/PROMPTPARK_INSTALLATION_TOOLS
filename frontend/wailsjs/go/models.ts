export namespace main {
	
	export class DeploymentHistoryRecord {
	    timestamp: string;
	    server: string;
	    targetPath: string;
	    status: string;
	    message: string;
	    envContent: string;
	
	    static createFrom(source: any = {}) {
	        return new DeploymentHistoryRecord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.timestamp = source["timestamp"];
	        this.server = source["server"];
	        this.targetPath = source["targetPath"];
	        this.status = source["status"];
	        this.message = source["message"];
	        this.envContent = source["envContent"];
	    }
	}
	export class EntranceConfig {
	    ip: string;
	    deviceName: string;
	    gateNo: string;
	    plcIp: string;
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
	        return new EntranceConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ip = source["ip"];
	        this.deviceName = source["deviceName"];
	        this.gateNo = source["gateNo"];
	        this.plcIp = source["plcIp"];
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
	}
	export class ExitConfig {
	    ip: string;
	    deviceName: string;
	    gateNo: string;
	    plcIp: string;
	    parkingCode: string;
	    projectCode: string;
	    paymentTicket: string;
	    serverUrl: string;
	    localServerUrl: string;
	    vehicleMode: string;
	    apiMode: string;
	    zoningMode: string;
	    zoningCode: string;
	    zoningGateNo: string;
	    nextZoningCode: string;
	    nextZoningGateNo: string;
	    isCash: boolean;
	    isQR: boolean;
	    ticketMode: string;
	
	    static createFrom(source: any = {}) {
	        return new ExitConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ip = source["ip"];
	        this.deviceName = source["deviceName"];
	        this.gateNo = source["gateNo"];
	        this.plcIp = source["plcIp"];
	        this.parkingCode = source["parkingCode"];
	        this.projectCode = source["projectCode"];
	        this.paymentTicket = source["paymentTicket"];
	        this.serverUrl = source["serverUrl"];
	        this.localServerUrl = source["localServerUrl"];
	        this.vehicleMode = source["vehicleMode"];
	        this.apiMode = source["apiMode"];
	        this.zoningMode = source["zoningMode"];
	        this.zoningCode = source["zoningCode"];
	        this.zoningGateNo = source["zoningGateNo"];
	        this.nextZoningCode = source["nextZoningCode"];
	        this.nextZoningGateNo = source["nextZoningGateNo"];
	        this.isCash = source["isCash"];
	        this.isQR = source["isQR"];
	        this.ticketMode = source["ticketMode"];
	    }
	}
	export class ExitKioskDevice {
	    ip: string;
	    deviceName: string;
	    gateNo: string;
	    plcIp: string;
	
	    static createFrom(source: any = {}) {
	        return new ExitKioskDevice(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ip = source["ip"];
	        this.deviceName = source["deviceName"];
	        this.gateNo = source["gateNo"];
	        this.plcIp = source["plcIp"];
	    }
	}
	export class ExitKioskDeployConfig {
	    apkPath: string;
	    devices: ExitKioskDevice[];
	    parkingCode: string;
	    projectCode: string;
	    paymentTicket: string;
	    serverUrl: string;
	    localServerUrl: string;
	    vehicleMode: string;
	    apiMode: string;
	    zoningMode: string;
	    zoningCode: string;
	    zoningGateNo: string;
	    nextZoningCode: string;
	    nextZoningGateNo: string;
	    isCash: boolean;
	    isQR: boolean;
	    ticketMode: string;
	
	    static createFrom(source: any = {}) {
	        return new ExitKioskDeployConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.apkPath = source["apkPath"];
	        this.devices = this.convertValues(source["devices"], ExitKioskDevice);
	        this.parkingCode = source["parkingCode"];
	        this.projectCode = source["projectCode"];
	        this.paymentTicket = source["paymentTicket"];
	        this.serverUrl = source["serverUrl"];
	        this.localServerUrl = source["localServerUrl"];
	        this.vehicleMode = source["vehicleMode"];
	        this.apiMode = source["apiMode"];
	        this.zoningMode = source["zoningMode"];
	        this.zoningCode = source["zoningCode"];
	        this.zoningGateNo = source["zoningGateNo"];
	        this.nextZoningCode = source["nextZoningCode"];
	        this.nextZoningGateNo = source["nextZoningGateNo"];
	        this.isCash = source["isCash"];
	        this.isQR = source["isQR"];
	        this.ticketMode = source["ticketMode"];
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
	export class InstallationProfile {
	    name: string;
	    updatedAt: string;
	    data: number[];
	
	    static createFrom(source: any = {}) {
	        return new InstallationProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.updatedAt = source["updatedAt"];
	        this.data = source["data"];
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
	
	export class PreflightCheck {
	    name: string;
	    ok: boolean;
	    message: string;
	    detail: string;
	
	    static createFrom(source: any = {}) {
	        return new PreflightCheck(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.ok = source["ok"];
	        this.message = source["message"];
	        this.detail = source["detail"];
	    }
	}
	export class ValidationIssue {
	    field: string;
	    message: string;
	    level: string;
	
	    static createFrom(source: any = {}) {
	        return new ValidationIssue(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.field = source["field"];
	        this.message = source["message"];
	        this.level = source["level"];
	    }
	}
	export class ValidationReport {
	    ok: boolean;
	    issues: ValidationIssue[];
	    warnings: ValidationIssue[];
	
	    static createFrom(source: any = {}) {
	        return new ValidationReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
	        this.issues = this.convertValues(source["issues"], ValidationIssue);
	        this.warnings = this.convertValues(source["warnings"], ValidationIssue);
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

