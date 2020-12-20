import { Result } from "../common/dto";
import Overlay from "./overlay";
import DialogWindow from "./dialog_window";
import Common from "../common/common";
import OverlayManager from "./overlay_manager";
import IFrameWindow from "./iframe_window";


export default class IFrameProxy {
    private static singleton = new IFrameProxy();
    private static iframeIdSequence: number = 0;

    private hostIsRegisterd: boolean = false;

    private documentContexts = new Map<string, DocumentContext>();
    private createdOverlayPool = new Map<string, Overlay>();

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

    private initializeIFrameWindow(overlayName: string, url: string): IFrameWindow {
        if (this.createdOverlayPool.has(overlayName)) {
            const overlay = this.createdOverlayPool.get(overlayName) as IFrameWindow;
            overlay.changeSourceUrl(url);
            return overlay;
        } else {
            const overlay = new IFrameWindow(overlayName, url);
            this.createdOverlayPool.set(overlayName, overlay);
            return overlay;
        }
    }

    private postMessageHandler(e: MessageEvent) {
        if (!e.data.isOverlayjsMessage || e.data.toDownstream) return;
        if (!e.data || !e.data.command) throw new Error("パラメータが不正です。");
        if (!e.data.sender) throw new Error("FrameIDが未指定です。loadイベントハンドラ実行後に実行する必要があります。");

        const data = e.data;
        const params = data.params ? data.params : {};
        const dCtx: DocumentContext = this.documentContexts.get(data.sender);
        const senderOverlay: Overlay = dCtx.getHolderOverlay();
        const senderDocumentWindow: Window = dCtx.getDocumentWindow();
        const overlayManager: OverlayManager = dCtx.getOverlayManager();
        const overlayName = params.name;
        const overlay = overlayManager.getOverlay(overlayName);
        let promise: Promise<Result> = null;
        let targetIframeWindow: IFrameWindow;

        const sendReturnCommand = (result) => {
            senderDocumentWindow.postMessage({
                command: "return", params: result, sender: overlayName, toDownstream: true, isOverlayjsMessage: true
            }, "*"); 
        }
        
        switch (data.command) {
            case "ok":
                if (senderOverlay) senderOverlay.close(Result.ok(params));
                break;
            case "cancel":
                if (senderOverlay) senderOverlay.close(Result.cancel(params));
                break;
            case "open":
                overlayManager.open(overlay, params.openConfig, params.loadParams).then(result => {
                    sendReturnCommand(result);
                });
                break;
            case "openAsModal":
                overlayManager.openAsModal(overlay, params.openConfig, params.loadParams).then(result => {
                    sendReturnCommand(result);
                });
                break;
            case "openLinkInNewWindow":
                targetIframeWindow = this.initializeIFrameWindow(overlayName, params.loadParams.url);
                overlayManager.open(targetIframeWindow, params.openConfig, params.loadParams).then(result => {
                    sendReturnCommand(result);
                });
                break;
            case "openLinkInNewModalWindow":
                targetIframeWindow = this.initializeIFrameWindow(overlayName, params.loadParams.url);
                overlayManager.openAsModal(targetIframeWindow, params.openConfig, params.loadParams).then(result => {
                    sendReturnCommand(result);
                });
                break;
            case "close":
                if (overlay) overlay.close(params);
                break;
            case "showLoadingOverlay":
                if (senderOverlay) {
                    (senderOverlay as DialogWindow).showLocalWaitScreen(params.message, params.showProgressBar, params.progressRatio);
                } else {
                    overlayManager.showLoadingOverlay(
                        params.message, 
                        params.showProgressBar, 
                        params.progressRatio
                        ).then(result => {
                            if (result.isOk) return;
                            senderDocumentWindow.postMessage({
                                command: "stop", params: result, sender: params.name, toDownstream: true, isOverlayjsMessage: true
                            }, "*");
                        });
                }
                break;
            case "hideLoadingOverlay":
                if (senderOverlay) {
                    (senderOverlay as DialogWindow).hideLocalWaitScreen();
                } else {
                    overlayManager.hideLoadingOverlay();
                }
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
    private static POLLING_INTERVAL: number = 50;
    private static POLLING_TIMEOUT: number = 5000;

    private onIFrameLoadEventHandlerBindThis;
    private onPageHideEventHandlerBindThis;
    private mouseMoveEventHanderBindThis;
    private mouseDownEventHanderBindThis;
    private onloadHandlerIsExecuted = false;

    constructor( 
        private iframeEl: HTMLIFrameElement,
        private iframeId: string,
        private overlayManager: OverlayManager,
        private holderOverlay: Overlay,
        private overlaysLoadEventHandler: () => void) {

            this.mouseMoveEventHanderBindThis = this.mouseMoveEventHander.bind(this);
            this.mouseDownEventHanderBindThis = this.mouseDownEventHander.bind(this);
            this.onIFrameLoadEventHandlerBindThis = this.iFrameOnLoadHandler.bind(this);
            this.onPageHideEventHandlerBindThis = this.pageHideEventHandler.bind(this);
            const window = this.iframeEl.contentWindow as any;

            this.iFrameOnLoadHandler(null);

            //ページ遷移完了後に発火する
            //（ただし、初回ロード時にreadyStateがすでにこの時点でcompleteの場合でも発火する場合があるので
            //  重複実行への対策が必要 -> onloadHandlerIsExecutedフラグ）
            this.iframeEl.addEventListener("load", this.onIFrameLoadEventHandlerBindThis);
    }

    private async iFrameOnLoadHandler(e: Event) {
        let iFrameWindow: IFrameWindow = null;
        if (this.holderOverlay && this.holderOverlay instanceof IFrameWindow) {
            iFrameWindow = this.holderOverlay as IFrameWindow;
            if (!iFrameWindow.getIFrameIsActive()) return;
        }

        if (this.onloadHandlerIsExecuted) return;
        this.onloadHandlerIsExecuted = true;

        const iframeWindow = this.iframeEl.contentWindow;

        this.overlayManager.triggerIFramesPageChangedEventHandler(iframeWindow.location.href, this.iframeId, 
            this.holderOverlay ? this.holderOverlay.getName(): "");

        try {
            await this.waitOjsClientInitializing();
        } catch(e) {
            this.onloadHandlerIsExecuted = false;
            throw e;
        }

        let loadParams;

        if (iFrameWindow) {
            loadParams = iFrameWindow.getLoadParams();
            iFrameWindow.hideLocalWaitScreen();
        }

        //ページ遷移を検出してonloadHandlerIsExecutedフラグをリセットする
        iframeWindow.addEventListener("pagehide", this.onPageHideEventHandlerBindThis);

        iframeWindow.addEventListener("mousemove", this.mouseMoveEventHanderBindThis);
        iframeWindow.addEventListener("mousedown", this.mouseDownEventHanderBindThis);

        iframeWindow.postMessage({
            command: "dispatchConfig",
            params: {
                frameId: this.iframeId,
                loadParams: loadParams
            },
            toDownstream: true,
            isOverlayjsMessage: true
        }, "*");
        
        if (this.overlaysLoadEventHandler) this.overlaysLoadEventHandler();

        const embeddedIframes = iframeWindow.document.getElementsByTagName("iframe");
        for (let i = 0; i < embeddedIframes.length; i++) {
            IFrameProxy.getInstance().register(embeddedIframes[i], this.overlayManager);
        }
    }

    private async waitOjsClientInitializing() {
        await this.waitContextLoading();

        return new Promise<void>((resolve, reject) => {
            const window = this.iframeEl.contentWindow as any;

            if (window[Common.CLIENT_INSTANCE_NAME] && window[Common.CLIENT_INSTANCE_NAME].isLoaded()) {
                //すでにロード済み
                resolve();
            } else {
                //スクリプトが遅延ロードされているときはポーリングにて監視
                let pollingElapsedTime = 0;
                const sprictLoadWatcherId = setInterval(() => {
                    if (window[Common.CLIENT_INSTANCE_NAME] && window[Common.CLIENT_INSTANCE_NAME].isLoaded()) {
                        clearInterval(sprictLoadWatcherId);
                        resolve();
                    }
    
                    //エラー時無限ポーリング防止
                    pollingElapsedTime += IFrameContext.POLLING_INTERVAL;
                    if (pollingElapsedTime > IFrameContext.POLLING_TIMEOUT) {
                        clearInterval(sprictLoadWatcherId);
                        reject();
                    }
    
                }, IFrameContext.POLLING_INTERVAL);
            }
        });
    }

    private async waitContextLoading() {
        const window = this.iframeEl.contentWindow as any;

        return new Promise<void>((resolve, reject) => {
            if (window && window.document.readyState === "complete") {
                resolve();
            } else {
                const loadEventHandler = () => {
                    this.iframeEl.removeEventListener("load", loadEventHandler);
                    resolve();
                }
                this.iframeEl.addEventListener("load", loadEventHandler);
            }
        });
    }

    private pageHideEventHandler() {
        this.iframeEl.contentWindow.removeEventListener("pagehide", this.onPageHideEventHandlerBindThis);
        this.onloadHandlerIsExecuted = false;
    }

    private mouseMoveEventHander(e: MouseEvent): void {
        const rect: DOMRect = this.iframeEl.getBoundingClientRect();
        Common.currentMouseClientX = e.clientX + rect.left;
        Common.currentMouseClientY = e.clientY + rect.top;
    }

    private mouseDownEventHander(e: MouseEvent): void {
        this.overlayManager.handoverMouseDownEvent(e);
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
        this.iframeEl.removeEventListener("load", this.onIFrameLoadEventHandlerBindThis);
    }
}

class HostContext implements DocumentContext {
    private handlerBindThis;

    constructor( 
        private frameId: string,
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
            command: "dispatchConfig",
            params: {
                frameId: this.frameId
            },
            toDownstream: true,
            isOverlayjsMessage: true
        }, "*");
        
        const embeddedIframes = window.document.getElementsByTagName("iframe");

        for (let i = 0; i < embeddedIframes.length; i++) {
            //埋め込みのiframeでsrcがタグ属性で直に設定されていた場合は例外を生成する
            //（親コンテキストがロード中の場合はparentが親を示さない（iframe自身を示す）ため、
            //ホスト検出ができずにそのiframe自身がホストになってしまうため）
            if (embeddedIframes[i].getAttribute("src")) {
                const iframwWindow = embeddedIframes[i].contentWindow;
                const errorMsg = "HTML内におけるiframeのsrc属性直接指定には対応していません。代わりにonloadイベント内で設定することができます。";

                iframwWindow.document.open();
                iframwWindow.document.write(errorMsg);
                iframwWindow.document.close();

                console.error(errorMsg);

            } else {
                IFrameProxy.getInstance().register(embeddedIframes[i], this.overlayManager);
            }
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