export namespace models {
	
	export class POCTemplate {
	    id: string;
	    name: string;
	    author: string;
	    severity: string;
	    description: string;
	    reference: string[];
	    tags: string[];
	    category: string;
	    content: string;
	    filePath: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new POCTemplate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.author = source["author"];
	        this.severity = source["severity"];
	        this.description = source["description"];
	        this.reference = source["reference"];
	        this.tags = source["tags"];
	        this.category = source["category"];
	        this.content = source["content"];
	        this.filePath = source["filePath"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
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
	export class ScanOptions {
	    concurrency: number;
	    timeout: number;
	    rateLimit: number;
	    bulkSize: number;
	    headless: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ScanOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.concurrency = source["concurrency"];
	        this.timeout = source["timeout"];
	        this.rateLimit = source["rateLimit"];
	        this.bulkSize = source["bulkSize"];
	        this.headless = source["headless"];
	    }
	}
	export class ScanRequest {
	    targets: string[];
	    templateIds: string[];
	    options: ScanOptions;
	
	    static createFrom(source: any = {}) {
	        return new ScanRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.targets = source["targets"];
	        this.templateIds = source["templateIds"];
	        this.options = this.convertValues(source["options"], ScanOptions);
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
	export class ScanResult {
	    id: string;
	    scanId: string;
	    templateId: string;
	    templateName: string;
	    severity: string;
	    host: string;
	    matched: string;
	    extractedData?: Record<string, string>;
	    // Go type: time
	    timestamp: any;
	    request?: string;
	    response?: string;
	
	    static createFrom(source: any = {}) {
	        return new ScanResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.scanId = source["scanId"];
	        this.templateId = source["templateId"];
	        this.templateName = source["templateName"];
	        this.severity = source["severity"];
	        this.host = source["host"];
	        this.matched = source["matched"];
	        this.extractedData = source["extractedData"];
	        this.timestamp = this.convertValues(source["timestamp"], null);
	        this.request = source["request"];
	        this.response = source["response"];
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
	export class ScanStatus {
	    id: string;
	    status: string;
	    progress: number;
	    total: number;
	    completed: number;
	    found: number;
	    // Go type: time
	    startedAt: any;
	    // Go type: time
	    completedAt?: any;
	    error?: string;
	    targets: string[];
	    templateIds: string[];
	
	    static createFrom(source: any = {}) {
	        return new ScanStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.status = source["status"];
	        this.progress = source["progress"];
	        this.total = source["total"];
	        this.completed = source["completed"];
	        this.found = source["found"];
	        this.startedAt = this.convertValues(source["startedAt"], null);
	        this.completedAt = this.convertValues(source["completedAt"], null);
	        this.error = source["error"];
	        this.targets = source["targets"];
	        this.templateIds = source["templateIds"];
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
	export class Settings {
	    concurrency: number;
	    timeout: number;
	    rateLimit: number;
	    bulkSize: number;
	    templatesDir: string;
	    proxyUrl?: string;
	    headless: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.concurrency = source["concurrency"];
	        this.timeout = source["timeout"];
	        this.rateLimit = source["rateLimit"];
	        this.bulkSize = source["bulkSize"];
	        this.templatesDir = source["templatesDir"];
	        this.proxyUrl = source["proxyUrl"];
	        this.headless = source["headless"];
	    }
	}
	export class Stats {
	    totalPocs: number;
	    totalScans: number;
	    byCategory: Record<string, number>;
	    bySeverity: Record<string, number>;
	
	    static createFrom(source: any = {}) {
	        return new Stats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalPocs = source["totalPocs"];
	        this.totalScans = source["totalScans"];
	        this.byCategory = source["byCategory"];
	        this.bySeverity = source["bySeverity"];
	    }
	}

}

