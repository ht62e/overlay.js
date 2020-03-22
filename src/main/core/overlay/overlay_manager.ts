import Overlay, { OverlayShowOptions } from "./overlay";
import { Result } from "../common/dto";
import CssTransitionDriver from "../common/css_transition_driver";
import IFrameProxy from "./iframe_proxy";
import WaitScreen from "./wait_screen";

export interface OverlayConfig {
    modal?: boolean;
    forceForeground? : boolean;
    autoCloseWhenOutfocus?: boolean;
    parentOverlay?: Overlay;
}

class OverlayStatus {
    public isVisible: boolean = false;
    public isModal: boolean = false;
    public unmountTimerHandle: number = null;
    
    public reset(): OverlayStatus {
        this.isVisible = false;
        this.isModal = false;
        this.unmountTimerHandle = null;
        return this;
    }
}

export default class OverlayManager {
    private static INSTANT_MOUNTED_OVERLAY_AUTO_UNMOUNT_DELAY_TIME = 1000;

    private static DEFAULT_OVERLAY_START_Z_INDEX: number = 10;
    private static MODAL_START_Z_INDEX: number = 1000;
    private static AUTO_CLOSEABLE_START_Z_INDEX: number = 2000;
    private static FOREGROUND_Z_INDEX: number = 3000;

    private viewPortEl: HTMLElement = null;
    private viewPortBaseIFrame: HTMLIFrameElement;
    private viewPortBaseIFrameId: string;

    public overlayLastFocusedElement: HTMLElement = null;

    private modalBackgroundLayer: HTMLDivElement;
    private modalBackgroundLayerTransitionDriver: CssTransitionDriver;
    private modalCount: number = 0;

    private overlays: Map<string, Overlay>;
    private permanentMountTable: Map<string, boolean>;
    private statusTable: Map<string, OverlayStatus>;
    private configTable: Map<string, OverlayConfig>;

    private activeOverlay: Overlay;
    private defaultWaitScreen: WaitScreen;

    private previousMouseX: number = 0;
    private previousMouseY: number = 0;

    private contentsSelectable: boolean = true;

    private requestedAutoCloseCancelOnlyOnce: boolean = false;

    private onFocusInBindedThis: (event: FocusEvent) => void;
    private onMouseDownBindedThis: (event: MouseEvent) => void;
    private onMouseMoveBindedThis: (event: MouseEvent) => void;
    private onMouseUpBindedThis: (event: FocusEvent) => void;
    private onSelectStartBindedThis: (event: FocusEvent) => void;
    private windowResizeEventHandlerBindThis: (event: Event) => void;

    constructor(viewPortElement: HTMLElement) {
        if (!viewPortElement) throw new Error("指定されたビューポートは存在しません。");

        this.overlays = new Map<string, Overlay>();
        this.permanentMountTable = new Map<string, boolean>();
        this.statusTable = new Map<string, OverlayStatus>();
        this.configTable = new Map<string, OverlayConfig>();

        viewPortElement.style.position = "relative";

        let _s = this.modalBackgroundLayer = document.createElement("div");
        _s.className = "ojs_modal_background_layer";
        _s.style.position = "absolute";
        _s.style.top = "0px";
        _s.style.left = "0px";
        _s.style.overflow = "hidden";
        _s.style.width = "100%";
        _s.style.height = "100%";
        _s.style.display = "none";
        _s.style.zIndex = String(OverlayManager.MODAL_START_Z_INDEX);

        this.modalBackgroundLayerTransitionDriver = new CssTransitionDriver(this.modalBackgroundLayer);

        this.onFocusInBindedThis = this.onFocusIn.bind(this);
        this.onMouseDownBindedThis = this.onMouseDown.bind(this);
        this.onMouseMoveBindedThis = this.onMouseMove.bind(this);
        this.onMouseUpBindedThis = this.onMouseUp.bind(this);
        this.onSelectStartBindedThis = this.onSelectStart.bind(this);
        this.windowResizeEventHandlerBindThis = this.windowResizeEventHandler.bind(this);

        window.addEventListener("focusin", this.onFocusInBindedThis);
        window.addEventListener("mousedown", this.onMouseDownBindedThis);
        window.addEventListener("mousemove", this.onMouseMoveBindedThis);
        window.addEventListener("mouseup", this.onMouseUpBindedThis);
        window.addEventListener("selectstart", this.onSelectStartBindedThis);
        window.addEventListener("resize", this.windowResizeEventHandlerBindThis);

        this.setViewPortElement(viewPortElement);

        this.defaultWaitScreen = new WaitScreen();
        this.mountPermanently(this.defaultWaitScreen, null);
    }

    public sendMessage(destination: string, data: any, sender: string): Promise<Result> {
        const destOverlay = this.overlays.get(destination);
        if (!destOverlay) throw new Error("送り先オーバーレイ [" + data.destination + "] は存在しません。");
        return destOverlay.onReceiveMessage(data, this.overlays.get(sender));
    }

    public broadcastMessage(data: any, sender: string): void {
        const senderOverlay = this.overlays.get(sender);
        this.overlays.forEach((overlay: Overlay, name: string) => {
            if (overlay !== senderOverlay) {
                overlay.onReceiveMessage(data, senderOverlay);
            }
        });
    }  

    private onMouseDown(event: MouseEvent) {
        if (!this.requestedAutoCloseCancelOnlyOnce) {
            this.statusTable.forEach((status: OverlayStatus, name: string) => {
                if (status.isVisible && this.configTable.get(name).autoCloseWhenOutfocus) {
                    const overlay = this.overlays.get(name);
                    // const module = overlay.getChildContainer().getCurrentModule();
                    // module.exit(ActionType.CANCEL).then(exited => {
                    //     if (exited) overlay.close();
                    // });
                }
            });
        }
        this.requestedAutoCloseCancelOnlyOnce = false;
    }



    private onMouseMove(event: MouseEvent) {
        let deltaX = event.screenX - this.previousMouseX;
        let deltaY = event.screenY - this.previousMouseY;
        this.previousMouseX = event.screenX;
        this.previousMouseY = event.screenY;
        this.overlays.forEach(overlay => {
            overlay.__dispachMouseMoveEvent(event.screenX, event.screenY, deltaX, deltaY);
        });
    }

    private onMouseUp(event: MouseEvent) {
        this.overlays.forEach(overlay => {
            overlay.__dispachMouseUpEvent(event.screenX, event.screenY);
        });
        this.changeContentsSelectable(true);
    }

    private windowResizeEventHandler(event: Event): void {
        this.overlays.forEach(overlay => {
            overlay.onViewPortResize(this.viewPortEl.offsetWidth, this.viewPortEl.offsetHeight);
        });        
    }

    private onSelectStart(event: Event) {
        if (!this.contentsSelectable) {
            event.preventDefault();
        }
    }

    private onFocusIn(event: FocusEvent) {
        this.overlayLastFocusedElement = null;
    }

    public getViewPortElement() {
        return this.viewPortEl;
    }

    public setViewPortElement(element: HTMLElement) {
        this.viewPortEl = element;
        element.appendChild(this.modalBackgroundLayer);
    }

    public setViewPortBaseIFrame(element: HTMLIFrameElement) {
        if (this.viewPortBaseIFrame) {
            IFrameProxy.getInstance().unregister(this.viewPortBaseIFrameId);
        }
        this.viewPortBaseIFrame = element;
        this.viewPortBaseIFrameId = IFrameProxy.getInstance().register(element, this);
    }

    private register(overlay: Overlay, overlayConfig?: OverlayConfig): void {
        const name: string = overlay.getName();
        const status = this.statusTable.get(name);

        if (!status) {
            this.overlays.set(name, overlay);
            this.statusTable.set(name, new OverlayStatus());
            this.configTable.set(name, overlayConfig ? overlayConfig : {});
            overlay.mount(this);
        } else if (status.unmountTimerHandle !== null) {
            //クローズアニメーションの最中
            window.clearTimeout(status.unmountTimerHandle);
            status.reset(); 
        } else {
            throw new Error("名前 [" + name + "] は既に登録されています。");
        }
    }

    private unregister(overlay: Overlay): void {
        const status = this.statusTable.get(overlay.getName());
        status.unmountTimerHandle = window.setTimeout(() => {
            this.overlays.delete(overlay.getName());
            this.statusTable.delete(overlay.getName());
            this.configTable.delete(overlay.getName());
            this.activateTopOverlay();
            overlay.unmount();
        }, OverlayManager.INSTANT_MOUNTED_OVERLAY_AUTO_UNMOUNT_DELAY_TIME);
    }

    private updateConfig(overlay: Overlay, overlayConfig?: OverlayConfig): void {
        this.configTable.set(overlay.getName(), overlayConfig ? overlayConfig : {});
    }

    public mountPermanently(overlay: Overlay, overlayConfig: OverlayConfig): void {
        this.permanentMountTable.set(overlay.getName(), true);
        this.register(overlay, overlayConfig);
    }

    public changeContentsSelectable(selectable: boolean) {
        this.contentsSelectable = selectable;
    }

    private beginModalMode() {
        ++this.modalCount;
        this.modalBackgroundLayerTransitionDriver.show();
    }

    private endModalMode() {
        --this.modalCount;
        if (this.modalCount === 0) {
            this.modalBackgroundLayerTransitionDriver.hide();
        }
    }

    private async _open(overlay: Overlay, config: OverlayConfig, params?: any, options?: OverlayShowOptions): Promise<Result> {
        if (!config) config = {};
        const overlayName = overlay.getName();
        const enableInstantMount: boolean = !this.permanentMountTable.has(overlayName);
        
        if (enableInstantMount) {
            this.register(overlay, config);
        } else {
            this.updateConfig(overlay, config);
        }

        const status = this.statusTable.get(overlayName);
        status.isVisible = true;
        status.isModal = !!config.modal;

        this.activateSpecificOverlay(overlayName);
        const result = await overlay.load(config.modal, params, options);

        status.isVisible = false;
        status.isModal = false;

        this.activateTopOverlay();

        if (enableInstantMount) {
            this.unregister(overlay);
        }

        return result;
    }

    public async open(overlay: Overlay, params?: any, options?: OverlayShowOptions): Promise<Result> {
        if (this.modalCount === 0) {
            return this._open(overlay, null, params, options);
        } else {
            return this.openAsModal(overlay, params, options);
        }
    }

    public async openAsModal(overlay: Overlay, params?: any, options?: OverlayShowOptions): Promise<Result> {
        this.beginModalMode();
        
        const config: OverlayConfig = {
            modal: true
        }
        const result = await this._open(overlay, config, params, options);

        this.endModalMode();

        return result;
    }

    public showWaitScreen(message, showProgressBar, progressRatio): Promise<Result> {
        const config: OverlayConfig = {
            forceForeground: true,
            parentOverlay: this.activeOverlay
        }
        return this._open(this.defaultWaitScreen, config, {
            message: message, showProgressBar: showProgressBar, progressRatio: progressRatio
        });
    }

    public hideWaitScreen() {
        //const status = this.statusTable.get(this.defaultWaitScreen.getName());
        //if (status && status.isVisible) {
        this.defaultWaitScreen.close(Result.ok());
        //}
    }

    public overlayMouseDownEventHandler(overlayName: string) {
        //TODO 要モーダル状態チェック
        this.activateSpecificOverlay(overlayName);
    }

    public activateSpecificOverlay(overlayName: string) {
        const overlayList = new Array<Overlay>();
        const targetOverlay = this.overlays.get(overlayName);

        this.overlays.forEach((value: Overlay, key: string) => {
            if (key !== overlayName) overlayList.push(value);
        });

        overlayList.sort((a: Overlay, b: Overlay): number => {
            return b.getZIndex() - a.getZIndex();
        });

        overlayList.unshift(targetOverlay);

        let visibleCount = 0;
        this.statusTable.forEach((value: OverlayStatus, key: string) => {
            if (value.isVisible) ++visibleCount;
        });

        let visibleOverlayCounter = 0;
        let previousOverlayConfig: OverlayConfig = null;
        let previousOverlay: Overlay = null;

        overlayList.forEach((overlay: Overlay) => {
            const overlayStatus = this.statusTable.get(overlay.getName());
            const overlayConfig = this.configTable.get(overlay.getName());

            if (overlayStatus.isVisible) {
                if (overlayConfig.forceForeground) {
                    overlay.changeZIndex(OverlayManager.FOREGROUND_Z_INDEX);
                } else if (overlayConfig.autoCloseWhenOutfocus) {
                    overlay.changeZIndex(OverlayManager.AUTO_CLOSEABLE_START_Z_INDEX + visibleCount--);
                } else if (overlayStatus.isModal) {
                    overlay.changeZIndex(OverlayManager.MODAL_START_Z_INDEX + visibleCount--);
                } else {
                    overlay.changeZIndex(OverlayManager.DEFAULT_OVERLAY_START_Z_INDEX + visibleCount--);
                }
                if (visibleOverlayCounter === 0 || 
                    (previousOverlay.isActive() && overlay === previousOverlayConfig.parentOverlay)) {
                    overlay.activate();
                    this.activeOverlay = overlay;
                } else {
                    overlay.inactivate(overlayStatus.isModal);
                }
                previousOverlayConfig = overlayConfig;
                previousOverlay = overlay;
                ++visibleOverlayCounter;
            }
        });

        
    }

    public activateTopOverlay() {
        //zindexが一番大きいoverlayを有効化する
        let maxZIndex = -1;
        let targetOverlayName;

        this.overlays.forEach((overlay: Overlay, name: string) => {
            if (this.statusTable.get(name).isVisible) {
                if (overlay.getZIndex() > maxZIndex) {
                    maxZIndex = overlay.getZIndex();
                    targetOverlayName = name;
                }
            }
        });
        
        if (maxZIndex > -1) {
            this.activateSpecificOverlay(targetOverlayName);
        }
    }

    public cancelAutoClosingOnlyOnce() {
        this.requestedAutoCloseCancelOnlyOnce = true;
    }

    public getOverlay(overlayName: string): Overlay {
        return this.overlays.get(overlayName);
    }
}


