import { IFrameWindow, OverlayManager } from "../../overlay";
import { Result } from "../common/dto";
import Overlay from "./overlay";
import DialogWindow from "./dialog_window";


export default class IFrameProxy {
    private static singleton = new IFrameProxy();
    private static iframeIdSequence: number = 0;

    private hostIsRegisterd: boolean = false;

    private documentContexts = new Map<string, DocumentContext>();
    private mountedOverlayPool = new Map<string, Overlay>();

    public static getInstance(): IFrameProxy {
        return IFrameProxy.singleton;
    }

    constructor() {
        window.addEventListener("message", this.postMessageHandler.bind(this));
    }

    public register(iframeEl: HTMLIFrameElement, overlayManager: OverlayManager, holderOverlay?: Overlay, overlaysLoadEventHandler?: () => void): string {
        const id: string = String(IFrameProxy.iframeIdSequence++);
        this.documentContexts.set(id, new IFrameContext(
            iframeEl, id, overlayManager, holderOverlay, overlaysLoadEventHandler
        ));
        return id;
    }

    public registerHost(overlayManager: OverlayManager): string {
        if (this.hostIsRegisterd) return;
        const id: string = String(IFrameProxy.iframeIdSequence++);
        this.documentContexts.set(id, new HostContext(id, overlayManager));
        this.hostIsRegisterd = true;
        return id;
    }

    public unregister(iframeId: string) {
        const ctx = this.documentContexts.get(iframeId);
        if (ctx) ctx.destory();
        this.documentContexts.delete(iframeId);
    }

    private getAvailableIFrameWindow(overlayName: string, url: string): IFrameWindow {
        if (this.mountedOverlayPool.has(overlayName)) {
            const overlay = this.mountedOverlayPool.get(overlayName) as IFrameWindow;
            overlay.changeSourceUrl(url);
            return overlay;
        } else {
            const overlay = new IFrameWindow(overlayName, url);
            this.mountedOverlayPool.set(overlayName, overlay);
            return overlay;
        }
    }

    private postMessageHandler(e: MessageEvent) {
        if (!e.data || !e.data.command || e.data.listenerClass !== "IFrameWindow") return;
        if (!e.data.sender) throw new Error("iFrameIDが未指定です。loadイベントハンドラ実行後に実行する必要があります。");

        const data = e.data;
        const params = data.params ? data.params : {};
        const overlayName = params.name;
        const dCtx: DocumentContext = this.documentContexts.get(data.sender);
        const senderOverlay: Overlay = dCtx.getHolderOverlay();
        const senderDocumentWindow: Window = dCtx.getDocumentWindow();
        const overlayManager: OverlayManager = dCtx.getOverlayManager();
        let promise: Promise<Result> = null;
        
        switch (data.command) {
            case "ok":
                if (senderOverlay) senderOverlay.close(Result.ok(params));
                break;
            case "cancel":
                if (senderOverlay) senderOverlay.close(Result.cancel(params));
                break;
            case "open":
                overlayManager.open(overlayManager.getOverlay(overlayName), params.openConfig, params.loadParams).then(result => {
                    senderDocumentWindow.postMessage({
                        command: "return", params: result, sender: overlayName
                    }, "*");
                });
                break;
            case "openAsModal":
                overlayManager.openAsModal(overlayManager.getOverlay(overlayName), params.openConfig, params.loadParams).then(result => {
                    senderDocumentWindow.postMessage({
                        command: "return", params: result, sender: overlayName
                    }, "*");
                });
                break;
            case "openNewIFrameWindow":
                overlayManager.open(this.getAvailableIFrameWindow(overlayName, params.loadParams.url), params.openConfig, params.loadParams).then(result => {
                    senderDocumentWindow.postMessage({
                        command: "return", params: result, sender: overlayName
                    }, "*");
                });
                break;
            case "openNewIFrameWindowAsModal":
                overlayManager.openAsModal(this.getAvailableIFrameWindow(overlayName, params.loadParams.url), params.openConfig, params.loadParams).then(result => {
                    senderDocumentWindow.postMessage({
                        command: "return", params: result, sender: overlayName
                    }, "*");
                });
                break;
            case "showLoadingOverlay":
                overlayManager.showLoadingOverlay(
                    params.message, 
                    params.showProgressBar, 
                    params.progressRatio
                    ).then(result => {
                        if (result.isOk) return;
                        senderDocumentWindow.postMessage({
                            command: "stop", params: result, sender: params.name
                        }, "*");
                    });
                break;
            case "hideLoadingOverlay":
                overlayManager.hideLoadingOverlay();
                break;
            case "changeWindowCaption":
                if (senderOverlay) (senderOverlay as DialogWindow).changeWindowCaption(params.caption);
                break;
            case "":
                break;
        }

        return promise;
    }
}

interface DocumentContext {
    getDocumentWindow(): Window;
    getOverlayManager(): OverlayManager;
    getHolderOverlay(): Overlay;
    destory();
}

class IFrameContext implements DocumentContext {
    private handlerBindThis;

    constructor( 
        private iframeEl: HTMLIFrameElement,
        private iframeId: string,
        private overlayManager: OverlayManager,
        private holderOverlay: Overlay,
        private overlaysLoadEventHandler: () => void) {

            this.handlerBindThis = this.iFrameOnLoadHandler.bind(this);
            const window = this.iframeEl.contentWindow as any;

            if (window && window.OjsClient && window.OjsClient.firedOnLoadEvent) {
                //すでにロード済み
                this.iFrameOnLoadHandler(null);
            } else {
                this.iframeEl.addEventListener("load", this.handlerBindThis);
            }
    }

    private iFrameOnLoadHandler(e: Event): void {
        const window = this.iframeEl.contentWindow;
        window.postMessage({
            command: "dispatchIFrameId",
            params: this.iframeId
        }, "*");
        
        if (this.overlaysLoadEventHandler) this.overlaysLoadEventHandler();

        const embeddedIframes = window.document.getElementsByTagName("iframe");
        for (let i = 0; i < embeddedIframes.length; i++) {
            IFrameProxy.getInstance().register(embeddedIframes[i], this.overlayManager);
        }
    }

    public getDocumentWindow(): Window {
        return this.iframeEl.contentWindow;
    }

    public getOverlayManager(): OverlayManager {
        return this.overlayManager;
    }

    public getHolderOverlay(): Overlay {
        return this.holderOverlay;
    }

    public destory() {
        this.iframeEl.removeEventListener("load", this.handlerBindThis);
    }
}

class HostContext implements DocumentContext {
    private handlerBindThis;

    constructor( 
        private iframeId: string,
        private overlayManager: OverlayManager) {
            this.handlerBindThis = this.iFrameOnLoadHandler.bind(this);
            
            if (window.document.readyState === "complete") {
                //すでにロード済みの場合
                this.iFrameOnLoadHandler(null);
            } else {
                window.addEventListener("load", this.handlerBindThis);
            }
    }

    private iFrameOnLoadHandler(e: Event): void {
        window.postMessage({
            command: "dispatchIFrameId",
            params: this.iframeId
        }, "*");
        
        const embeddedIframes = window.document.getElementsByTagName("iframe");
        for (let i = 0; i < embeddedIframes.length; i++) {
            IFrameProxy.getInstance().register(embeddedIframes[i], this.overlayManager);
        }
    }

    public getDocumentWindow(): Window {
        return window;
    }

    public getOverlayManager(): OverlayManager {
        return this.overlayManager;
    }

    public getHolderOverlay(): Overlay {
        return null;
    }

    public destory() {
        
    }
}