import OverlayManager from "./overlay_manager";
import { Point, Size, CssSize } from "../common/types";
import CssTransitionDriver from "../common/css_transition_driver";
import { Result } from "../common/dto";

export interface OverlayShowOptions {
    position?: Point;
    fixPositionToCenter?: boolean;
    maxWidthRatioOfViewPort?: number;
}

class EventAttachInfo {
    public eventName: string;
    public listener: (e: any) => void;
}

export default abstract class Overlay {
    public static DEFAULT_OVERLAY_SIZE_WIDTH: string = "50%";
    public static DEFAULT_OVERLAY_SIZE_HEIGHT: string = "50%";

    public static MIN_OVERLAY_SIZE_WIDTH_PX: number = 100;
    public static MIN_OVERLAY_SIZE_HEIGHT_PX: number = 100;

    public static DEFAULT_MAX_OVERLAY_WIDTH_RATIO_OF_VIEWPORT: number = 0.90;

    protected overlayManager: OverlayManager;

    protected name: string;

    protected viewPortEl: HTMLElement;

    protected frameEl: HTMLDivElement;
    protected outerContainerEl: HTMLDivElement;
    protected containerEl: HTMLDivElement;

    protected outerFrameTransitionDriver: CssTransitionDriver;

    //MEMO フォーカス移動検知パターン
    //(1) 最後のDOM→[tab]→tabFocusMoveTailDetector→(onfocusイベント内で)→tabFocusMoveHeadDetector
    //(2) 最初のDOM→[Shift+tab]→tabFocusMoveHeadDetector(onfocusイベント内で)→tabFocusMoveTailDetector
    //(3) tabFocusMoveHeadDetector(※1の直後)→[Shift+tab]→tabFocusMoveHeadStopper→(onfocusイベント内で)→最後のDOM(lastFocusedEl)
    //(4) tabFocusMoveTailDetector(※2の直後)→[tab]→tabFocusMoveTailStopper→(onfocusイベント内で)→最初のDOM(lastFocusedEl)
    //※3,4でlastFocusedElがnullの場合は反対側のDetectorにフォーカスを移動する
    protected tabFocusMoveHeadStopper: HTMLDivElement;
    protected tabFocusMoveHeadDetector: HTMLDivElement;
    protected tabFocusMoveTailDetector: HTMLDivElement;
    protected tabFocusMoveTailStopper: HTMLDivElement;

    protected lastFocusedEl: HTMLElement;
    protected lastFocusIsDetector: boolean = false;

    protected modalInactiveLayer: HTMLDivElement;
    protected modalInactiveLayerTransitionDriver: CssTransitionDriver;

    protected position: Point;
    protected size: CssSize;
    protected fixPositionToCenterMode: boolean;
    protected autoHeight: boolean;
    protected originalSize: CssSize;
    protected originalSizePx: Size;
    protected offsetSizeCache: Size;
    protected zIndex: number;
    protected maxWidthRatioOfViewPort: number;

    protected mounted: boolean = false;
    protected active: boolean = false;
    protected inactiveModalMode: boolean = false;

    protected attachedEventListeners = new Map<HTMLElement, EventAttachInfo>();

    protected waitForOverlayClosePromise: Promise<Result>;
    protected waitForOverlayCloseResolver: (value?: Result | PromiseLike<Result>) => void;
    
    public abstract async load(isModal: boolean, params?: any, options?: OverlayShowOptions): Promise<Result>;
    public abstract onReceiveMessage(data: any, sender: Overlay): Promise<Result>;

    constructor(name: string, size: CssSize) {
        this.name = name;
        const cssWidth = size ? size.cssWidth : Overlay.DEFAULT_OVERLAY_SIZE_WIDTH;
        const cssHeight = size ? size.cssHeight : Overlay.DEFAULT_OVERLAY_SIZE_HEIGHT;
        this.originalSize = new CssSize(cssWidth, cssHeight);

        this.frameEl = document.createElement("div");
        this.frameEl.style.position = "absolute";
        this.frameEl.style.backgroundColor = "transparent";

        //正しいスタイル計算のため初回表示まではdisplay:noneにはしない
        this.frameEl.style.visibility = "hidden";

        this.attachEventListener(this.frameEl, "selectstart", this.onSelectStart);
        this.attachEventListener(this.frameEl, "mousedown", this.onOuterMouseDown);  

        //キーボードタブキーナビゲーションによってダイアログの外にフォーカスが移ることを
        //防止（検知）するための非表示エレメントの作成（Shift+Tabキー対策）
        let _s: HTMLDivElement;
        _s = this.tabFocusMoveHeadStopper = document.createElement("div");
        _s.className = "ojs_tabfocus_move_stopper";
        _s.style.height = "0px";
        _s.tabIndex = 0;
        this.attachEventListener(_s, "focusin", this.onTabFocusMoveHeadStopperFocusIn);

        _s = this.tabFocusMoveHeadDetector = document.createElement("div");
        _s.className = "ojs_tabfocus_move_detector";
        _s.style.height = "0px";
        _s.tabIndex = 0;
        this.attachEventListener(_s, "focusin", this.onTabFocusMoveHeadDetectorFocusIn);

        //コンテンツ領域生成
        _s = this.containerEl = this.outerContainerEl = document.createElement("div");
        _s.style.position = "relative";
        _s.style.overflow = "hidden";
        _s.style.width = "100%";
        _s.style.height = "100%";
        if (this.autoHeight) {
            this.containerEl.style.height = "auto";
        }

        //overlayのモーダル表示によって非アクティブ化したときに表示するレイヤー
        _s = this.modalInactiveLayer = document.createElement("div");
        _s.className = "ojs_modal_background_layer";
        _s.style.position = "absolute";
        _s.style.overflow = "hidden";
        _s.style.display = "none";
        _s.style.top = "0px";
        _s.style.left = "0px";
        _s.style.width = "100%";
        _s.style.height = "100%";

        this.modalInactiveLayerTransitionDriver = new CssTransitionDriver(this.modalInactiveLayer);

        this.resize(this.originalSize.cssWidth, this.originalSize.cssHeight);

        //非表示エレメントの作成（Tabキー対策）
        _s = this.tabFocusMoveTailDetector = document.createElement("div");
        _s.className = "ojs_tabfocus_move_detector";
        _s.style.height = "0px";
        _s.tabIndex = 0;
        this.attachEventListener(_s, "focusin", this.onTabFocusMoveTailDetectorFocusIn);
        
        _s = this.tabFocusMoveTailStopper = document.createElement("div");
        _s.className = "ojs_tabfocus_move_stopper";
        _s.style.height = "0px";
        _s.tabIndex = 0;
        this.attachEventListener(_s, "focusin", this.onTabFocusMoveTailStopperFocusIn);

        this.attachEventListener(this.containerEl, "focusin", this.onFocusIn);
        this.attachEventListener(this.containerEl, "focusout", this.onFocusOut);

        this.frameEl.appendChild(this.tabFocusMoveHeadStopper);
        this.frameEl.appendChild(this.tabFocusMoveHeadDetector);
        this.frameEl.appendChild(this.containerEl);
        this.frameEl.appendChild(this.tabFocusMoveTailDetector);
        this.frameEl.appendChild(this.tabFocusMoveTailStopper);
        this.frameEl.appendChild(this.modalInactiveLayer);

        this.outerFrameTransitionDriver = new CssTransitionDriver(this.frameEl);

    }

    public mount(overlayManager: OverlayManager): void {
        this.overlayManager = overlayManager;
        this.viewPortEl = overlayManager.getViewPortElement();
        this.viewPortEl.appendChild(this.frameEl);
        this.originalSizePx = new Size(this.frameEl.offsetWidth, this.frameEl.offsetHeight);
        this.mounted = true;
    }

    public unmount(): void {
        this.frameEl.parentNode.removeChild(this.frameEl);
        this.mounted = false;
    }

    public isMounted(): boolean {
        return this.mounted;
    }

    public close(result: Result): void {
        this.outerFrameTransitionDriver.hide();
        if (this.waitForOverlayClosePromise) {
            this.waitForOverlayClosePromise = null;
            window.setTimeout(this.waitForOverlayCloseResolver.bind(this), 0, result);
        }
    }

    public destory(): void {
        this.detachAllEventListeners();
    }

    protected waitForOverlayClose(): Promise<Result> {
        if (this.waitForOverlayClosePromise) {
            return this.waitForOverlayClosePromise;
        } else {
            return this.waitForOverlayClosePromise = new Promise(resolve => {
                this.waitForOverlayCloseResolver = resolve;
            });
        }
    }

    public __dispachMouseMoveEvent(x: number, y: number, deltaX: number, deltaY: number) {
    }

    public __dispachMouseUpEvent(x: number, y: number) {
    }

    protected onOuterMouseDown(event: MouseEvent) {
        if (this.inactiveModalMode) return;
        this.overlayManager.overlayMouseDownEventHandler(this.name);
    }

    protected focusSelf() {
        this.tabFocusMoveHeadDetector.focus();
        this.lastFocusIsDetector = false;
        this.overlayManager.overlayLastFocusedElement = null;
    }

    private onSelectStart(event: Event) {

    }

    private onTabFocusMoveHeadStopperFocusIn(event: FocusEvent) {
        if (this.lastFocusedEl) {
            this.lastFocusedEl.focus();
        } else {
            this.tabFocusMoveHeadDetector.focus();
        }
    }

    private onTabFocusMoveHeadDetectorFocusIn(event: FocusEvent) {
        if (!this.lastFocusIsDetector) {
            this.lastFocusIsDetector = true;
            this.tabFocusMoveTailDetector.focus();
        }
        event.stopPropagation();
    }

    private onTabFocusMoveTailDetectorFocusIn(event: FocusEvent) {
        if (!this.lastFocusIsDetector) {
            this.lastFocusIsDetector = true;
            this.tabFocusMoveHeadDetector.focus();
        }
        event.stopPropagation();
    }

    private onTabFocusMoveTailStopperFocusIn(event: FocusEvent) {
        if (this.lastFocusedEl) {
            this.lastFocusedEl.focus();
        } else {
            this.tabFocusMoveTailDetector.focus();
        }
    }

    private onFocusIn(event: FocusEvent) {
        this.lastFocusIsDetector = false;
        this.overlayManager.overlayLastFocusedElement = null;
    }

    private onFocusOut(event: FocusEvent) {
        this.lastFocusIsDetector = false;
        this.lastFocusedEl = event.target as HTMLElement;
        this.overlayManager.overlayLastFocusedElement = event.target as HTMLElement;
    }

    public onViewPortResize(viewPortWidth: number, viewPortHeight: number) {
        if (this.fixPositionToCenterMode) {
            this.moveToViewPortCenter();
        }
    }

    protected cacheCurrentOffsetSize() {
        const w = this.frameEl.offsetWidth;
        const h = this.frameEl.offsetHeight;
        if (w > 0 && h > 0) this.offsetSizeCache = new Size(w, h);
    }

    protected restoreOriginalSize() {
        this.resize(this.originalSize.cssWidth, this.originalSize.cssHeight);
    }

    public changeZIndex(zIndex: number): void {
        this.zIndex = zIndex;
        this.frameEl.style.zIndex = String(zIndex);
    }

    public getName(): string {
        return this.name;
    }

    public getZIndex(): number {
        return this.zIndex;
    }

    public changePosition(x: number, y: number): void {
        if (y < 0) y = 0;
        this.position = new Point(x, y);
        this.frameEl.style.left = String(x) + "px";
        this.frameEl.style.top = String(y) + "px";
    }

    public moveToViewPortCenter(): void {
        if (!this.offsetSizeCache) this.cacheCurrentOffsetSize();
        let x = Math.round((this.viewPortEl.offsetWidth - this.offsetSizeCache.width) / 2);
        let y = Math.round((this.viewPortEl.offsetHeight - this.offsetSizeCache.height) / 2);
        if (y < 0) y = 0;
        this.changePosition(x, y);
    }

    public resize(width: string, height: string): void {
        this.size = new CssSize(width, height);
        this.frameEl.style.width = width;
        this.frameEl.style.height = height;
        this.cacheCurrentOffsetSize();
    }

    public activate(): void {
        if (!this.active) this.modalInactiveLayerTransitionDriver.hide();
        this.active = true;
        this.inactiveModalMode = false;
    }

    public inactivate(withModal: boolean): void {
        this.active = false;
        this.inactiveModalMode = withModal;
        if (withModal) {
            this.modalInactiveLayerTransitionDriver.show();
        }
    }

    public isActive(): boolean {
        return this.active;
    }

    public getOverlayManager(): OverlayManager {
        return this.overlayManager;
    }

    public getFrameElement(): HTMLDivElement {
        return this.frameEl;
    }

    protected attachEventListener(target: HTMLElement, eventName: string, listener: (e: any) => void) {
        const binded = listener.bind(this);
        target.addEventListener(eventName, binded);
        this.attachedEventListeners.set(target, {
            eventName: eventName, listener: binded
        });
    }

    protected detachAllEventListeners(): void {
        this.attachedEventListeners.forEach((info: EventAttachInfo, element: HTMLElement) => {
            element.removeEventListener(info.eventName, info.listener);
        });
    }



}
