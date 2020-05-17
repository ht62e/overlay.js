import Overlay, { OverlayOptions } from "./overlay";
import { Size } from "../common/types";
import { Result } from "../common/dto";
import Common from "../common/common";
import OverlayManager from "./overlay_manager";

export default class ContextMenu extends Overlay {
    protected contentEl: HTMLDivElement;
    protected onetimeSize: Size;

    constructor(name: string, options: OverlayOptions) {
        super(name, options);
    }

    public mount(overlayManager: OverlayManager): void {
        super.mount(overlayManager);

        let _s: HTMLDivElement;
        _s = this.contentEl = document.createElement("div");
        _s.className = "";
        _s.style.position = "relative";
        _s.style.width = "100%";
        _s.style.height = "100%";

        this.containerEl.className = "ojs_context_menu_container";
        this.containerEl.appendChild(this.contentEl);
        this.attachEventListener(this.containerEl, "mousedown", this.onContentMouseDown);

        this.outerFrameTransitionDriver.setCustomTransitionClasses({
            standyStateClass: "ojs_context_menu_standy_state",
            enterTransitionClass: "ojs_context_menu_enter_transition",
            leaveTransitionClass: "ojs_context_menu_leave_transition",
            endStateClass: "ojs_context_menu_end_state"
        });
    }
    
    public load(isModal: boolean, params?: any): Promise<Result> {
        let x: number, y: number;

        x = Common.currentMouseClientX;
        y = Common.currentMouseClientY;
        const widthPx = this.offsetSizeCache.width;
        const heightPx = this.offsetSizeCache.height;

        const overlayRightSideX: number = x + widthPx;
        const overlayBottomSideY: number = y + heightPx;

        const visibleAreaWidth: number = window.document.documentElement.clientWidth;
        const visibleAreaHeight: number = window.document.documentElement.clientHeight;

        const xVisibleAreaIsLargerThanOverlay: boolean = widthPx < visibleAreaWidth;
        const yVisibleAreaIsLargerThanOverlay: boolean = heightPx < visibleAreaHeight;

        const xCanDisplayOnNormalPosition: boolean = overlayRightSideX <= visibleAreaWidth;
        const yCanDisplayOnNormalPosition: boolean = overlayBottomSideY <= visibleAreaHeight;

        const xCanDisplayOnReversePosition: boolean = x >= widthPx;
        const yCanDisplayOnReversePosition: boolean = y >= heightPx;

        this.restoreOriginalSize();

        //x方向
        if (xVisibleAreaIsLargerThanOverlay) {
            if (xCanDisplayOnNormalPosition) {
                //指定された位置をそのまま左上座標にする
            } else if (xCanDisplayOnReversePosition) {
                x -= widthPx;
            } else {
                //右端に寄せる
                x = visibleAreaWidth - widthPx;
            }
        } else {
            x = 0; //入りきらない場合でも横方向は縮小せずに左端に寄せるだけにする
        }

        //y方向
        if (yVisibleAreaIsLargerThanOverlay) {
            if (yCanDisplayOnNormalPosition) {
                //指定された位置をそのまま左上座標にする
            } else if (yCanDisplayOnReversePosition) {
                y -= heightPx;
            } else {
                //下端に寄せる
                y = visibleAreaHeight - heightPx;
            }
        } else {
            //入りきらない場合は上端に寄せたのち、入りきらない分を一時的に縮小する
            y = 0;
            this.resize(widthPx + "px", visibleAreaHeight + "px");
        }

        this.changePosition(x, y);

        //this.container.initialize(parcel);
        this.outerFrameTransitionDriver.show();
  
        return this.waitForOverlayClose();
    }

    public onReceiveMessage(data: any, sender: Overlay): Promise<Result> {
        return Promise.resolve<Result>(null);
    }

    protected onContentMouseDown(event: MouseEvent) {
        this.overlayManager.cancelAutoClosingOnlyOnce();

    }
}