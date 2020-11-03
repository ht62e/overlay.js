import Overlay, { OverlayOptions } from "./overlay";
import { Result } from "../common/dto";
import CssTransitionDriver from "../common/css_transition_driver";
import IFrameProxy from "./iframe_proxy";
import LoadingOverlay from "./loading_overlay";
import { Point, CssSize } from "../common/types";

export interface OverlayOpenConfig {
    size? : CssSize;
    position?: Point;
    popupInCenterOfViewPort?: boolean;
    modal?: boolean;
    forceForeground? : boolean;
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

    private activeOverlay: Overlay = null;

    private modalBackgroundLayer: HTMLDivElement;
    private modalBackgroundLayerTransitionDriver: CssTransitionDriver;
    private modalCount: number = 0;

    private overlays: Map<string, Overlay>;
    private permanentMountTable: Map<string, boolean>;
    private statusTable: Map<string, OverlayStatus>;
    private configTable: Map<string, OverlayOpenConfig>;

    private defaultWaitScreen: LoadingOverlay;

    private previousMouseX: number = 0;
    private previousMouseY: number = 0;

    private contentsSelectable: boolean = true;

    private requestedCancelAutoClosingOnlyOnce: boolean = false;

    private waitOpenResolves: Map<string, Array<(value?: void | PromiseLike<void>) => void>> = new Map();

    private onFocusInBindedThis: (event: FocusEvent) => void;
    private onMouseDownBindedThis: (event: MouseEvent) => void;
    private onMouseMoveBindedThis: (event: MouseEvent) => void;
    private onMouseUpBindedThis: (event: FocusEvent) => void;
    private onSelectStartBindedThis: (event: FocusEvent) => void;
    private windowResizeEventHandlerBindThis: (event: Event) => void;

    private pageChangedEventHandler: (url: string, frameId: string, overlayName: string) => void;

    constructor(viewPortElement: HTMLElement) {
        if (!viewPortElement) throw new Error("指定されたビューポートは存在しません。");

        this.overlays = new Map<string, Overlay>();
        this.permanentMountTable = new Map<string, boolean>();
        this.statusTable = new Map<string, OverlayStatus>();
        this.configTable = new Map<string, OverlayOpenConfig>();

        viewPortElement.style.position = "relative";

        let _s = this.modalBackgroundLayer = document.createElement("div");
        _s.className = "ojs_modal_background_layer";
        _s.tabIndex = 0;
        _s.style.position = "absolute";
        _s.style.top = "0px";
        _s.style.left = "0px";
        _s.style.overflow = "hidden";
        _s.style.width = "100%";
        _s.style.height = "100%";
        _s.style.display = "none";
        _s.style.outline = "none";
        _s.style.zIndex = String(OverlayManager.MODAL_START_Z_INDEX);

        _s.addEventListener("focusout", this.onModalBackgroundLayerFocusOut.bind(this));

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

        this.defaultWaitScreen = new LoadingOverlay();
        this.mountPermanently(this.defaultWaitScreen);

        IFrameProxy.getInstance().registerHost(this);
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
        if (this.requestedCancelAutoClosingOnlyOnce) {
            this.requestedCancelAutoClosingOnlyOnce = false;
            return;
        }

        this.statusTable.forEach((status: OverlayStatus, name: string) => {
            const overlay = this.overlays.get(name);
            if (status.isVisible && overlay.getOptions().autoCloseOnOutfocus) {
                overlay.close({
                    isOk: false
                });
            }
        });
    }

    public handoverMouseDownEvent(event: MouseEvent) {
        this.onMouseDown(event);
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
        
    }

    private onModalBackgroundLayerFocusOut(event: FocusEvent) {
        if (this.activeOverlay) this.activeOverlay.focus();
    }

    public getViewPortElement() {
        return this.viewPortEl;
    }

    public setViewPortElement(element: HTMLElement) {
        this.viewPortEl = element;
        element.style.overflow = "hidden";
        element.appendChild(this.modalBackgroundLayer);

        //共通とするborder-radius値をCSSより取得
        // element.classList.add("ojs_overlay_border_radius");
        // let style = window.getComputedStyle(element);
        // let value = style.getPropertyValue("border-radius");
        // element.classList.remove("ojs_overlay_border_radius");
        
    }

    public setIFramesPageChangedEventHandler(handler: (url: string, frameId: string, overlayName: string) => void) {
        this.pageChangedEventHandler = handler;
    }

    public triggerIFramesPageChangedEventHandler(url: string, frameId: string, overlayName: string) {
        if (this.pageChangedEventHandler) this.pageChangedEventHandler(url, frameId, overlayName);
    }

    private register(overlay: Overlay, overlayConfig?: OverlayOpenConfig): void {
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
            overlay.mount(this);
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
            //this.activateTopOverlay();
            overlay.unmount();
        }, OverlayManager.INSTANT_MOUNTED_OVERLAY_AUTO_UNMOUNT_DELAY_TIME);
    }

    private updateConfig(overlay: Overlay, overlayConfig?: OverlayOpenConfig): void {
        this.configTable.set(overlay.getName(), overlayConfig ? overlayConfig : {});
    }

    public mountPermanently(overlay: Overlay): void {
        this.permanentMountTable.set(overlay.getName(), true);
        this.register(overlay);
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

    private async waitOpen(overlay: Overlay): Promise<void> {
        return new Promise(resovle => {
            const overlayName = overlay.getName();
            if (!this.waitOpenResolves.has(overlayName)) {
                this.waitOpenResolves.set(overlayName, []);
            }
            this.waitOpenResolves.get(overlayName).push(resovle);
            if (this.waitOpenResolves.get(overlayName).length === 1) resovle();
        });
    }

    private unlockWaitOpen(overlay: Overlay) {
        const overlayName = overlay.getName();
        const resolves = this.waitOpenResolves.get(overlayName);
        resolves.shift();
        if (resolves.length > 0) resolves[0]();
    }

    private async _open(overlay: Overlay, config: OverlayOpenConfig, params?: any): Promise<Result> {
        const overlayOptions: OverlayOptions = overlay.getOptions();

        if (overlay.isActive() && overlayOptions.forceCloseBeforeReopen) {
            overlay.forceClose();
        }
        
        if (!overlayOptions.allowToOverrideAlreadyOpened) {
            await this.waitOpen(overlay);
    
            if (overlay.isActive()) {
                console.error("オーバーレイがアクティブな状態で自オーバーレイを開きなおすことはできません。");
                if (!overlayOptions.allowToOverrideAlreadyOpened) {
                    this.unlockWaitOpen(overlay);
                }
                return Promise.resolve(Result.cancel());
            }
        }
        
        if (!config) config = {};
        const overlayName = overlay.getName();
        const enableInstantMount: boolean = !this.permanentMountTable.has(overlayName);
        
        if (enableInstantMount) {
            this.register(overlay, config);
        } else {
            this.updateConfig(overlay, config);
        }

        const status = this.statusTable.get(overlayName);
        status.isModal = !!config.modal;

        if (config.size) overlay.resize(config.size.cssWidth, config.size.cssHeight, true);
        if (config.position) overlay.changePosition(config.position.x, config.position.y);
        if (config.popupInCenterOfViewPort) overlay.moveToViewPortCenter();

        this.activateSpecificOverlay(overlayName);
        const result = await overlay.load(config.modal, params);

        overlay.inactivate(false);
        status.isVisible = false;
        status.isModal = false;

        this.activateTopOverlay();

        if (enableInstantMount) {
            this.unregister(overlay);
        }

        if (!overlayOptions.allowToOverrideAlreadyOpened) {
            this.unlockWaitOpen(overlay);
        }

        return result;
    }

    public async open(overlay: Overlay, config: OverlayOpenConfig, params?: any): Promise<Result> {
        if (this.modalCount === 0) {
            return this._open(overlay, config, params);
        } else {
            return this.openAsModal(overlay, config, params);
        }
    }

    public async openAsModal(overlay: Overlay, config: OverlayOpenConfig, params?: any): Promise<Result> {
        if (this.existOverlayInModalStack(overlay)) {
            console.error("モーダル表示中のオーバーレイを開きなおすことはできません。");
            return Promise.resolve(Result.cancel());
        }
        
        this.beginModalMode();
        
        let cfg = config ? config : {};
        cfg.modal = true;

        const result = await this._open(overlay, cfg, params);

        this.endModalMode();

        return result;
    }

    public showLoadingOverlay(message, showProgressBar, progressRatio): Promise<Result> {
        const config: OverlayOpenConfig = {
            forceForeground: true
        }
        return this._open(this.defaultWaitScreen, config, {
            message: message, showProgressBar: showProgressBar, progressRatio: progressRatio
        });
    }

    public hideLoadingOverlay() {
        this.defaultWaitScreen.close(Result.ok());
    }

    public overlayMouseDownEventHandler(overlayName: string) {
        //TODO 要モーダル状態チェック
        this.activateSpecificOverlay(overlayName);
    }

    public activateSpecificOverlay(overlayName: string) {
        const overlayList = new Array<Overlay>();
        const targetOverlay = this.overlays.get(overlayName);

        this.statusTable.get(overlayName).isVisible = true;

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
        let subVisibleOverlayCounter = 0;

        overlayList.forEach((overlay: Overlay) => {
            const overlayStatus = this.statusTable.get(overlay.getName());
            const overlayConfig = this.configTable.get(overlay.getName());

            if (overlayStatus.isVisible) {
                if (overlayConfig.forceForeground) {
                    overlay.changeZIndex(OverlayManager.FOREGROUND_Z_INDEX);
                } else if (overlay.getOptions().autoCloseOnOutfocus) {
                    overlay.changeZIndex(OverlayManager.AUTO_CLOSEABLE_START_Z_INDEX + visibleCount--);
                } else if (overlayStatus.isModal) {
                    overlay.changeZIndex(OverlayManager.MODAL_START_Z_INDEX + visibleCount--);
                } else {
                    overlay.changeZIndex(OverlayManager.DEFAULT_OVERLAY_START_Z_INDEX + visibleCount--);
                }

                if (visibleOverlayCounter - subVisibleOverlayCounter === 0) {
                    overlay.activate(subVisibleOverlayCounter === 0);
                    this.activeOverlay = overlay;
                    
                } else {
                    overlay.inactivate(overlayStatus.isModal);
                }

                ++visibleOverlayCounter;
                if (overlay.getOptions().subOverlay) ++subVisibleOverlayCounter;
            }
        });

        if (this.activeOverlay) this.activeOverlay.focus();
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

    private existOverlayInModalStack(targetOverlay: Overlay) {
        let exist: boolean = false;

        this.statusTable.forEach((status: OverlayStatus, name: string) => {
            const overlay = this.overlays.get(name);
            if (targetOverlay === overlay && status.isVisible && status.isModal) {
                exist = true;
            }
        });
        return exist;
    }

    public returnTabFocusToActiveOverlay() {
        if (this.activeOverlay) this.activeOverlay.focus();
    }

    public cancelAutoClosingOnlyOnce() {
        this.requestedCancelAutoClosingOnlyOnce = true;
    }

    public getOverlay(overlayName: string): Overlay {
        return this.overlays.get(overlayName);
    }
}


