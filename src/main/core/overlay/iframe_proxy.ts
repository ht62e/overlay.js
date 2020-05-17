import { IFrameWindow, OverlayManager } from "../../overlay";
import { Result } from "../common/dto";
import Overlay from "./overlay";
import Window from "./window";



export default class IFrameProxy {
    private static singleton = new IFrameProxy();
    private static iframeIdSequence: number = 1;

    private iframeContexts = new Map<string, IFrameContext>();
    private mountedOverlayPool = new Map<string, Overlay>();

    public static getInstance(): IFrameProxy {
        return IFrameProxy.singleton;
    }

    constructor() {
        window.addEventListener("message", this.postMessageHandler.bind(this));
    }

    public register(iframeEl: HTMLIFrameElement, overlayManager: OverlayManager, holderOverlay?: Overlay, overlaysLoadEventHandler?: () => void): string {
        const id: string = String(IFrameProxy.iframeIdSequence++);
        this.iframeContexts.set(id, new IFrameContext(
            iframeEl, id, overlayManager, holderOverlay, overlaysLoadEventHandler
        ));
        return id;
    }

    public unregister(iframeId: string) {
        const ctx = this.iframeContexts.get(iframeId);
        if (ctx) ctx.destory();
        this.iframeContexts.delete(iframeId);
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
        const iCtx: IFrameContext = this.iframeContexts.get(data.sender);
        const senderOverlay: Overlay = iCtx.getHolderOverlay();
        const senderIFrame: HTMLIFrameElement = iCtx.getIFrameEl();
        const overlayManager: OverlayManager = iCtx.getOverlayManager();
        let promise: Promise<Result> = null;
        
        switch (data.command) {
            case "ok":
                senderOverlay.close(Result.ok(params));
                break;
            case "cancel":
                senderOverlay.close(Result.cancel(params));
                break;
            case "open":
                overlayManager.open(overlayManager.getOverlay(overlayName), params.openConfig, params.loadParams).then(result => {
                    senderIFrame.contentWindow.postMessage({
                        command: "return", params: result, sender: overlayName
                    }, "*");
                });
                break;
            case "openAsModal":
                overlayManager.openAsModal(overlayManager.getOverlay(overlayName), params.openConfig, params.loadParams).then(result => {
                    senderIFrame.contentWindow.postMessage({
                        command: "return", params: result, sender: overlayName
                    }, "*");
                });
                break;
            case "openNewIFrameWindow":
                overlayManager.open(this.getAvailableIFrameWindow(overlayName, params.loadParams.url), params.openConfig, params.loadParams).then(result => {
                    senderIFrame.contentWindow.postMessage({
                        command: "return", params: result, sender: overlayName
                    }, "*");
                });
                break;
            case "openNewIFrameWindowAsModal":
                overlayManager.openAsModal(this.getAvailableIFrameWindow(overlayName, params.loadParams.url), params.openConfig, params.loadParams).then(result => {
                    senderIFrame.contentWindow.postMessage({
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
                        senderIFrame.contentWindow.postMessage({
                            command: "stop", params: result, sender: params.name
                        }, "*");
                    });
                break;
            case "hideLoadingOverlay":
                overlayManager.hideLoadingOverlay();
                break;
            case "changeWindowCaption":
                if (senderOverlay) {
                    (senderOverlay as Window).changeWindowCaption(params.caption);
                }
                break;
            case "":
                break;
        }

        return promise;
    }
}

class IFrameContext {
    private handlerBindThis;

    constructor( 
        private iframeEl: HTMLIFrameElement,
        private iframeId: string,
        private overlayManager: OverlayManager,
        private holderOverlay: Overlay,
        private overlaysLoadEventHandler: () => void) {

            this.handlerBindThis = this.iFrameOnLoadHandler.bind(this);
            this.iframeEl.addEventListener("load", this.handlerBindThis);
            if (this.iframeEl.contentWindow) {
                //すでにロード済みの場合
                this.iFrameOnLoadHandler(null);
            }
    }

    private iFrameOnLoadHandler(e: Event): void {
        const window = this.iframeEl.contentWindow;
        if (window) {
            window.postMessage({
                command: "dispatchIFrameId",
                params: this.iframeId
            }, "*");
            if (this.overlaysLoadEventHandler) this.overlaysLoadEventHandler();
        }
    }

    public getIFrameEl(): HTMLIFrameElement {
        return this.iframeEl;
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