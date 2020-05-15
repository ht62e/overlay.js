import Overlay, { OverlayOptions } from "./overlay";
import { Size } from "../common/types";
import { Result } from "../common/dto";
import OverlayManager from "./overlay_manager";

export interface DrawerOptions extends OverlayOptions {
    dockType?: DockType;
    dockSize?: string;
}

export enum DockType {
    Top, Right, Bottom, Left
}

export default class Drawer extends Overlay {
    protected contentEl: HTMLDivElement;
    protected onetimeSize: Size;

    protected dockType: DockType;
    protected dockSize: string;

    constructor(name: string, templateRootElement: HTMLElement, options: DrawerOptions) {
        super(name, options);

        this.dockType = options.dockType !== undefined ? options.dockType: DockType.Left;
        this.dockSize = options.dockSize !== undefined ? options.dockSize: "33%";
    }

    public mount(overlayManager: OverlayManager): void {
        super.mount(overlayManager);

        this.changeDockType(this.dockType);

        let _s: HTMLDivElement;
        _s = this.contentEl = document.createElement("div");
        _s.className = "";
        _s.style.position = "relative";
        _s.style.width = "100%";
        _s.style.height = "100%";

        this.containerEl.className = "ojs_drawer_container";
        this.containerEl.appendChild(this.contentEl);
        this.attachEventListener(this.containerEl, "mousedown", this.onContentMouseDown);
        
    }

    public changeDockType(dockType: DockType) {
        //サイズ変更
        if (dockType === DockType.Left || dockType === DockType.Right) {
            this.frameEl.style.width = this.dockSize;
            this.frameEl.style.height = "100%";
            
        } else if (dockType === DockType.Top || dockType === DockType.Bottom) {
            this.frameEl.style.width = "100%";
            this.frameEl.style.height = this.dockSize;
        }

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
    
    public load(isModal: boolean, params?: any, options?: OverlayOptions): Promise<Result> {
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