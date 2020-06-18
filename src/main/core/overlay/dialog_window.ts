import OverlayManager from "./overlay_manager";
import ResizableOverlay from "./resizable_overlay";
import Overlay, { OverlayOptions } from "./overlay";
import WaitScreen from "../common/wait_screen";

export interface WindowOptions extends OverlayOptions {
    defaultCaption?: string;
    resizable?: boolean;
    hideHeader?: boolean;
}

export default abstract class DialogWindow extends ResizableOverlay {
    
    protected windowOptions: WindowOptions;

    protected wrapperEl: HTMLDivElement;
    protected headerEl: HTMLDivElement;
    protected windowContentEl: HTMLDivElement;

    protected waitScreen: WaitScreen;

    protected headerCaptionEl: HTMLDivElement;
    protected headerCloseButtonEl: HTMLDivElement;

    protected isDragging: boolean = false;

    protected abstract onHeaderCloseButtonClick(event: MouseEvent): void;

    constructor(name: string, options?: WindowOptions) {
        super(name, options);

        this.windowOptions = options;

        if (options && options.resizable === false) {
            this.setResizable(false);
        }

        const _wop = this.windowOptions;

        let _s: HTMLDivElement;
        _s = this.wrapperEl = document.createElement("div");
        _s.style.position = "absolute";
        _s.style.display = "flex";
        _s.style.flexDirection = "column";
        _s.style.width = "100%";
        _s.style.height = "100%";

        _s = this.headerEl = document.createElement("div");
        _s.className = "ojs_window_header";
        _s.style.position = "relative";
        _s.style.display = "flex";
        _s.style.flexShrink = "0";
        _s.style.width = "100%";
        if (_wop && _wop.hideHeader) {
            this.headerEl.style.display = "none";
        }

        _s = this.headerCaptionEl = document.createElement("div");
        _s.className = "caption";
        _s.textContent = _wop && _wop.defaultCaption ? _wop.defaultCaption : "";

        _s = this.headerCloseButtonEl = document.createElement("div");
        _s.className = "close_button";
        this.attachEventListener(_s, "click", this.onHeaderCloseButtonClick);

        _s = this.headerEl;
        _s.appendChild(this.headerCaptionEl);
        _s.appendChild(this.headerCloseButtonEl);
        this.attachEventListener(_s, "mousedown", this.onHeaderMouseDown);
        this.attachEventListener(_s, "dragstart", this.onHeaderDragStart);

        _s = this.windowContentEl = document.createElement("div");
        _s.className = "ojs_window_content";
        _s.style.position = "relative";
        _s.style.flexGrow = "1";
        _s.style.flexShrink = "1";
        _s.style.width = "100%";
        _s.style.height = "100%";

        this.waitScreen = new WaitScreen();
        this.windowContentEl.appendChild(this.waitScreen.getScreenElement());
        
        this.wrapperEl.appendChild(this.headerEl);
        this.wrapperEl.appendChild(this.windowContentEl);

        this.containerEl.className = "ojs_window_container";
        this.containerEl.appendChild(this.wrapperEl);
        
    }

    public mount(overlayManager: OverlayManager): void {
        super.mount(overlayManager);
        //デフォルト表示位置は表示領域（ビューポート）の中央
        this.moveToViewPortCenter();
    }

    protected onHeaderMouseDown(event: MouseEvent) {
        this.isDragging = true;
        this.overlayManager.changeContentsSelectable(false);
    }

    protected onHeaderDragStart(event: MouseEvent) {
        event.preventDefault();
    }

    //override
    protected onOuterMouseDown(event: MouseEvent) {
        super.onOuterMouseDown(event);
        this.windowContentEl.style.pointerEvents = "none";
    }

    //override
    public __dispachMouseMoveEvent(x: number, y: number, deltaX: number, deltaY: number) {
        super.__dispachMouseMoveEvent(x, y, deltaX, deltaY);
        if (!this.isDragging) return;
        this.changePosition(this.position.x + deltaX, this.position.y + deltaY);
    }

    //override
    public __dispachMouseUpEvent(x: number, y: number) {
        super.__dispachMouseUpEvent(x, y);
        this.isDragging = false;
        if (this.isActive()) {
            this.windowContentEl.style.pointerEvents = "auto";
        }
    }

    public changeWindowCaption(title: string) {
        this.headerCaptionEl.textContent = title;
    }

    public showLocalWaitScreen(message: string, showProgressBar?: boolean, progressRatio?: number): void {
        this.waitScreen.show(message, showProgressBar, progressRatio);
    }

    public hideLocalWaitScreen() {
        this.waitScreen.hide();
    }

    //override
    public activate(isFront: boolean): void {
        super.activate(isFront);
        this.windowContentEl.style.pointerEvents = "auto";
        this.headerEl.classList.remove("inactive");
    }

    //override
    public inactivate(withModal: boolean): void {
        super.inactivate(withModal);
        this.windowContentEl.style.pointerEvents = "none";
        this.headerEl.classList.add("inactive");
    }     
}

