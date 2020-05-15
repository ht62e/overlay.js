import Window, { WindowOptions } from "./window";
import OverlayManager from "./overlay_manager";
import Overlay, { OverlayOptions } from "./overlay";
import { Result } from "../common/dto";
import IFrameProxy from "./iframe_proxy";

export default class IFrameWindow extends Window {
    protected sourceUrl: string;
    protected iframeEl: HTMLIFrameElement;
    protected iframeId: string;

    constructor(name: string, url: string, options?: WindowOptions) {
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

    //Overlay
    public mount(overlayManager: OverlayManager): void {
        super.mount(overlayManager);
        this.iframeId = IFrameProxy.getInstance().register(this.iframeEl, this.overlayManager, this);
    }

    //Overlay
    public unmount(): void {
        super.unmount();
        IFrameProxy.getInstance().unregister(this.iframeId);
    }

    public async load(isModal: boolean, params?: any, options?: OverlayOptions): Promise<Result> {
        this.iframeEl.src = this.sourceUrl;
        this.iframeEl.style.pointerEvents = "inherit";
        this.outerFrameTransitionDriver.show();
        
        return this.waitForOverlayClose();
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
        if (this.iframeEl.contentWindow) {
            this.iframeEl.contentWindow.postMessage({
                command: "headerCloseButtonClicked"
            }, "*");
        } else {
            this.close({
                isOk: false
            });
        }
    }

    //override
    public close(result: Result): void {
        super.close(result);
        this.iframeEl.style.pointerEvents = "none";
    }
}