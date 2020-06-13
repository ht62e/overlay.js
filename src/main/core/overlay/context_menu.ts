import Overlay, { OverlayOptions } from "./overlay";
import { Size, CssSize } from "../common/types";
import { Result } from "../common/dto";
import Common from "../common/common";

export default class ContextMenu extends Overlay {
    protected contentEl: HTMLElement;
    protected onetimeSize: Size;

    protected static DEFAULT_SIZE_WIDTH: string = "200px";
    protected static DEFAULT_SIZE_HEIGHT: string = "auto";

    constructor(name: string, contentEl: HTMLElement, options: OverlayOptions) {
        if (!options) options = {};

        if (!options.size) {
            options.size = new CssSize(ContextMenu.DEFAULT_SIZE_WIDTH, ContextMenu.DEFAULT_SIZE_HEIGHT);
        }

        super(name, options);

        options.subOverlay = true;
        options.forceCloseBeforeReopen = true;
        if (options.autoCloseOnOutfocus === undefined) options.autoCloseOnOutfocus = true;

        this.contentEl = contentEl;

        this.outerFrameTransitionDriver.setCustomTransitionClasses({
            standyStateClass: "ojs_context_menu_standy_state",
            enterTransitionClass: "ojs_context_menu_enter_transition",
            leaveTransitionClass: "ojs_context_menu_leave_transition",
            endStateClass: "ojs_context_menu_end_state"
        });

        this.containerEl.className = "ojs_context_menu_container";
        this.containerEl.appendChild(this.contentEl);
    }
    
    public load(isModal: boolean, params?: any): Promise<Result> {
        let x: number, y: number;

        x = Common.currentMouseClientX;
        y = Common.currentMouseClientY;

        if (!this.offsetSizeCache) this.cacheCurrentOffsetSize();

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

}