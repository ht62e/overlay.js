import DialogWindow, { WindowOptions } from "./dialog_window";
import OverlayManager from "./overlay_manager";
import Overlay, { OverlayOptions } from "./overlay";
import { Result } from "../common/dto";
import IFrameProxy from "./iframe_proxy";

export interface IFrameWindowOptions extends WindowOptions {
    url?: string;
}

export default class IFrameWindow extends DialogWindow {
    protected sourceUrl: string;
    protected iframeEl: HTMLIFrameElement;
    protected frameId: string = null;
    protected loadParams: any;

    constructor(name: string, url: string, options?: IFrameWindowOptions) {
        super(name, options);
        this.sourceUrl = url;

        let _f: HTMLIFrameElement;
        _f = this.iframeEl = document.createElement("iframe");
        _f.className = "ojs_iframe_dialog_window_content";
        _f.style.position = "relative";
        _f.style.width = "100%";
        _f.style.height = "100%";

        this.windowContentEl.appendChild(_f);
    }

    //Override
    public mount(overlayManager: OverlayManager): void {
        super.mount(overlayManager);

        if (this.frameEl !== null) {
            IFrameProxy.getInstance().unregister(this.frameId);
        }

        this.frameId = IFrameProxy.getInstance().register(
            this.iframeEl, this.overlayManager, this, this.onIFrameLoaded.bind(this));
    }

    //Override
    public unmount(): void {
        super.unmount();
        IFrameProxy.getInstance().unregister(this.frameId);
    }

    public async load(isModal: boolean, params?: any): Promise<Result> {
        this.loadParams = params;
        this.changeWindowCaption("");

        this.iframeEl.contentWindow.location.replace(this.sourceUrl);
        
        this.iframeEl.style.pointerEvents = "inherit";

        this.outerFrameTransitionDriver.show();
        
        return this.waitForOverlayClose();
    }

    public changeSourceUrl(url: string): void {
        this.sourceUrl = url;
    }

    public getLoadParams(): any {
        return this.loadParams;
    }

    public onIFrameLoaded(): void {
        try {
            this.changeWindowCaption(this.iframeEl.contentWindow.document.title);
        } catch (e) {
            this.changeWindowCaption("");
        }
    }

    public onReceiveMessage(data: any, sender: Overlay): Promise<Result> {
        const window = this.iframeEl.contentWindow;
        if (window) {
            window.postMessage({
                command: "receiveMessage",
                value: data,
                sender: sender
            }, "*");
        }  
        return Promise.resolve<Result>(null);
    }

    protected onHeaderCloseButtonClick(event: MouseEvent): void {
        const window = this.iframeEl.contentWindow;
        const clientNs = (window as any).OjsClient;
        
        if (window && clientNs && clientNs.getFrameId && clientNs.getFrameId() !== undefined) {
            this.iframeEl.contentWindow.postMessage({
                command: "headerCloseButtonClicked"
            }, "*");
        } else {
            this.forceClose();
        }
    }

    //Override
    public close(result: Result): void {
        super.close(result);
        this.iframeEl.contentWindow.location.replace("about:blank");
        this.iframeEl.style.pointerEvents = "none";
    }
}