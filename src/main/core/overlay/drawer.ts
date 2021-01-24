import Overlay, { OverlayOptions } from "./overlay";
import { Size } from "../common/types";
import { Result } from "../common/dto";
import OverlayManager from "./overlay_manager";

export interface DrawerOptions extends OverlayOptions {
    dockType?: DockType;
    dockCssSize?: string;
    originSideCssOffset?: string;
    originFarSideCssOffset?: string;
}

export enum DockType {
    Top, Right, Bottom, Left
}

export default class Drawer extends Overlay {
    protected contentEl: HTMLElement;
    protected onetimeSize: Size;

    protected dockType: DockType;
    protected dockSize: string;
    protected originSideCssOffset: string;
    protected originFarSideCssOffset: string;

    constructor(name: string, contentEl: HTMLElement, options?: DrawerOptions) {
        if (!options) options = {};

        super(name, options);

        if (options.autoCloseOnOutfocus === undefined) options.autoCloseOnOutfocus = true;

        this.contentEl = contentEl;
        this.dockType = options.dockType !== undefined ? options.dockType: DockType.Left;
        this.dockSize = options.dockCssSize !== undefined ? options.dockCssSize: "25%";
        this.originSideCssOffset = options.originSideCssOffset;
        this.originFarSideCssOffset = options.originFarSideCssOffset;

        this.changeDockType(this.dockType);

        this.containerEl.classList.add("ojs_drawer_container");
        this.containerEl.appendChild(this.contentEl);   
    }

    public changeDockType(dockType: DockType) {
        let heightAdjust: string;
        let widthAdjust: string;

        //位置変更
        this.frameEl.style.left = "";
        this.frameEl.style.right = "";
        this.frameEl.style.top = "";
        this.frameEl.style.bottom = "";
        
        if (dockType === DockType.Left || dockType === DockType.Top || dockType === DockType.Bottom) {
            //left=0パターン
            this.frameEl.style.left = "0px";
        } else {
            //right=0パターン(DockType.Right)
            this.frameEl.style.right = "0px";
        }

        if (dockType === DockType.Left || dockType === DockType.Right || dockType === DockType.Top) {
            //top=0パターン
            this.frameEl.style.top = "0px";
        } else {
            //bottom=0パターン(DockType.Bottom)
            this.frameEl.style.bottom = "0px";
        }

        //オフセット（マージン）
        if (this.originSideCssOffset) {
            const _os = this.originSideCssOffset;
            if (dockType === DockType.Left || dockType === DockType.Right) {
                this.frameEl.style.top = _os;
                this.frameEl.style.bottom = "";
            } else if (dockType === DockType.Top || dockType === DockType.Bottom) {
                this.frameEl.style.left = _os;
                this.frameEl.style.right = "";
            }
            widthAdjust = _os;
        } else if (this.originFarSideCssOffset) {
            const _os = this.originFarSideCssOffset;
            if (dockType === DockType.Left || dockType === DockType.Right) {
                this.frameEl.style.top = "";
                this.frameEl.style.bottom = _os;
            } else if (dockType === DockType.Top || dockType === DockType.Bottom) {
                this.frameEl.style.left = "";
                this.frameEl.style.right = _os;
            }
            heightAdjust = _os;
        }

        //サイズ変更
        if (dockType === DockType.Left || dockType === DockType.Right) {
            this.frameEl.style.width = this.dockSize;
            if (heightAdjust) {
                this.frameEl.style.height = "calc(100% - " + heightAdjust + ")";
            } else {
                this.frameEl.style.height = "100%";
            }            
        } else if (dockType === DockType.Top || dockType === DockType.Bottom) {
            this.frameEl.style.height = this.dockSize;
            if (widthAdjust) {
                this.frameEl.style.width = "calc(100% - " + widthAdjust + ")";
            } else {
                this.frameEl.style.width = "100%";
            }
        }

        //TransitionDriverクラス変更
        let dockTypeName: string;
        switch (dockType) {
            case DockType.Left: dockTypeName = "left"; break;
            case DockType.Right: dockTypeName = "right"; break;
            case DockType.Top: dockTypeName = "top"; break;
            case DockType.Bottom: dockTypeName = "bottom"; break;
        }
        
        this.outerFrameTransitionDriver.setCustomTransitionClasses({
            standyStateClass: "ojs_drawer_" + dockTypeName + "_dock_standy_state",
            enterTransitionClass: "ojs_drawer_enter_transition",
            leaveTransitionClass: "ojs_drawer_leave_transition",
            endStateClass: "ojs_drawer_" + dockTypeName + "_dock_end_state"
        });
    }
    
    //Override
    public changePosition(x: number, y: number): void {
        //何もしない
    }
    
    public load(isModal: boolean, params?: any): Promise<Result> {
        this.outerFrameTransitionDriver.show();
  
        return this.waitForOverlayClose();
    }

    public onReceiveMessage(data: any, sender: Overlay): Promise<Result> {
        return Promise.resolve<Result>(null);
    }

}