import { Result } from "./core/common/dto";
import Common from "./core/common/common";

export default class OjsClient {
    private firedOnLoadEvent = false;

    public MessageDialogMode = {
        INFO: 0,
        SUCCESS: 1,
        ALERT: 2,
        ERROR: 3,
        CONFIRM: 10,
        CONFIRM_CAUTION: 11,
        CONFIRM_DELETE: 12,
    };

    private receiveMessageEventListener: (params: any) => void;
    private clientBootstrapFunction: (params: any) => void;

    private awaitCallTable = new Map<string, Array<any>>();
    private pendingCallers = new Array<any>();

    private hostContext: Window = null;

    private frameId: number = null;

    constructor() {
        let parent: any = window.parent;
        try {
            while (!parent[Common.HOST_FLAG_NAME] && parent.parent !== parent) {
                parent = parent.parent;
            }
        } catch (e) {
            //親のドメインが異なる場合はこのコンテキストがホストに設定される
            parent = window;
        }
        
        this.hostContext = parent;

        window.addEventListener("load", () => {
            this.firedOnLoadEvent = true;
        });

        if (window.document.readyState === "complete") {
            this.firedOnLoadEvent = true;
        }

        window.addEventListener("message", (e: MessageEvent) => {
            const data = e.data;
            switch (data.command) {
                case "dispatchConfig":
                    this.frameId = data.params.frameId;
                    this.runAllPendingCallers();
                    if (this.clientBootstrapFunction) this.clientBootstrapFunction(data.params.loadParams);
                    break;
                case "headerCloseButtonClicked":
                    if (window["onCloseRequest"]) {
                        if (window["onCloseRequest"]()) this.cancelAndClose();
                    } else {
                        this.cancelAndClose();
                    }
                    break;
                case "receiveMessage":
                    this.receiveMessageEventListener(data.params);
                    break;
                case "return":
                    this.resolvePromiseTrigger(data.sender, data.params);
                    break;
            }
        });
    }

    public isLoaded(): boolean {
        return this.firedOnLoadEvent;
    }

    public getFrameId(): number {
        return this.frameId;
    }

    public getHostContext(): Window {
        return this.hostContext;
    }

    public setOverlayjsOnLoadEventHandler(handler: (params: any) => void): void {
        this.clientBootstrapFunction = handler;
    }

    public addPromiseTrigger(overlayName: string, promiseResolve, promiseReject): void {
        if (!this.awaitCallTable[overlayName]) {
            this.awaitCallTable[overlayName] = []; 
        }
        this.awaitCallTable[overlayName].push({
            resolve: promiseResolve,
            reject: promiseReject
        });
    }
    
    public resolvePromiseTrigger(overlayName: string, returnValue: Result): void {
        const trigger = this.awaitCallTable[overlayName].shift();
        if (returnValue.isOk) {
            trigger.resolve(returnValue);
        } else {
            trigger.reject();
        }
    }
    
    public runAllPendingCallers(): void {
        const initCallerCount = this.pendingCallers.length;
        for (let i = 0; i < this.pendingCallers.length; i++) {
            this.pendingCallers[i]["func"].apply(this, 
                this.pendingCallers[i]["args"],
                this.pendingCallers[i]["promiseResolve"],
                this.pendingCallers[i]["promiseReject"]
            );
        }
        this.pendingCallers.splice(0, initCallerCount);
    }
    
    public pendPostMessage(func, args, promiseResolve, promiseReject): void  {
        this.pendingCallers.push({
            func: func, args: args, promiseResolve: promiseResolve, promiseReject: promiseReject
        });
    }
    
    public tryAndPendPostMessage(func, args, promiseResolve?, promiseReject?): boolean {
        if (this.getFrameId() !== null) return true;
        
        this.pendingCallers.push({
            func: func, args: args, promiseResolve: promiseResolve, promiseReject: promiseReject
        });

        return false;
    }
    
    public sendMessage(destination: string, data: any): void {
        if (!this.tryAndPendPostMessage(this.sendMessage, arguments)) return;
        
        this.hostContext.postMessage({
            command: "sendMessage",
            destination: destination,
            params: data,
            sender: this.getFrameId(),
            isOverlayjsMessage: true
        }, "*");
    }
    
    public broadcastMessage(data: any): void {
        if (!this.tryAndPendPostMessage(this.broadcastMessage, arguments)) return;
        
        this.hostContext.postMessage({
            command: "broadcastMessage",
            destination: "*",
            params: data,
            sender: this.getFrameId(),
            isOverlayjsMessage: true
        }, "*");   
    }
    
    public changeWindowCaption(caption: string): void {
        if (!this.tryAndPendPostMessage(this.changeWindowCaption, arguments)) return;
        
        this.hostContext.postMessage({
            command: "changeWindowCaption",
            params: {caption: caption},
            sender: this.getFrameId(),
            isOverlayjsMessage: true
        }, "*");
    }
    
    public returnAndClose(data: any): void {
        if (!this.tryAndPendPostMessage(this.returnAndClose, arguments)) return;
        
        this.hostContext.postMessage({
            command: "ok",
            params: data,
            sender: this.getFrameId(),
            isOverlayjsMessage: true
        }, "*");
    }
    
    public cancelAndClose(): void {
        if (!this.tryAndPendPostMessage(this.cancelAndClose, arguments)) return;
        
        this.hostContext.postMessage({
            command: "cancel",
            sender: this.getFrameId(),
            isOverlayjsMessage: true
        }, "*");
    }
    
    public returnAndCloseOverlay(name, data: any): void {
        if (!this.tryAndPendPostMessage(this.returnAndCloseOverlay, arguments)) return;
        
        this.hostContext.postMessage({
            command: "returnAndCloseOverlay",
            targetOverlay: name,
            sender: this.getFrameId(),
            params: data,
            isOverlayjsMessage: true
        }, "*");
    }
    
    private _open(name: string, command: string, params: any, openConfig, _promiseResolve?, _promiseReject?): Promise<any> {
        let promise: Promise<any> = null;
        let promiseResolve, promiseReject;
    
        if (_promiseResolve) {
            promiseResolve = _promiseResolve;
            promiseReject = _promiseReject;
        } else {
            promise = new Promise(function(resolve, reject) {
                promiseResolve = resolve;
                promiseReject = reject;
            });
        }
    
        //FrameID未割当時に対する待機
        if (!this.tryAndPendPostMessage(this._open, arguments, promiseResolve, promiseReject)) {
            return promise;
        }
    
        var postMsgParams = {
            loadParams: params,
            openConfig: openConfig
        }
    
        this.addPromiseTrigger(name, promiseResolve, promiseReject);
    
        this.hostContext.postMessage({
            command: command,
            targetOverlay: name,
            params: postMsgParams,
            sender: this.getFrameId(),
            isOverlayjsMessage: true
        }, "*");
    
        return promise;    
    }
    
    public open(name: string, params: any, openConfig): Promise<any> {
        return this._open(name, "open", params, openConfig);
    }
    
    public openAsModal(name: string, params: any, openConfig): Promise<any> {
        return this._open(name, "openAsModal", params, openConfig);
    }
    
    public openLinkInNewWindow(name: string, url: string, params: any, openConfig): Promise<any> {
        if (!params) params = {};
        params.url = url;
        return this._open(name, "openLinkInNewWindow", params, openConfig);
    }
    
    public openLinkInNewModalWindow(name: string, url: string, params: any, openConfig): Promise<any> {
        if (!params) params = {};
        params.url = url;
        return this._open(name, "openLinkInNewModalWindow", params, openConfig);
    }
    
    public showLoadingOverlay(message: string, showProgressBar: boolean, progressRatio: number): void {
        this.hostContext.postMessage({
            command: "showLoadingOverlay",
            params: {
                message: message,
                showProgressBar: showProgressBar,
                progressRatio: progressRatio
            },
            sender: this.getFrameId(),
            isOverlayjsMessage: true
        }, "*");
    }
    
    public hideLoadingOverlay(): void {
        this.hostContext.postMessage({
            command: "hideLoadingOverlay",
            sender: this.getFrameId(),
            isOverlayjsMessage: true
        }, "*");
    }
}