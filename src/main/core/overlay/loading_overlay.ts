import Overlay, { OverlayOptions } from "./overlay";
import { Result } from "../common/dto";
import { CssSize } from "../common/types";

export default class LoadingOverlay extends Overlay {
    public static DEFAULT_NAME: string = "_default_wait_screen";

    protected loadingAnimationEl: HTMLDivElement;
    protected messageEl: HTMLDivElement;
    protected progressFrameEl: HTMLDivElement;
    protected progressEl: HTMLDivElement;

    constructor() {
        const options: OverlayOptions = {size: new CssSize("100%", "100%")};
        super(LoadingOverlay.DEFAULT_NAME, options);

        let _el: HTMLDivElement;

        _el = this.containerEl;
        _el.className = "ojs_wait_screen_container";
        _el.style.top = "0px";
        _el.style.left = "0px";
        _el.style.display = "flex";
        _el.style.flexDirection = "column";
        _el.style.justifyContent = "center";
        _el.style.alignItems = "center";


        _el = this.loadingAnimationEl = document.createElement("div");
        _el.innerHTML = '<div class="wball_css_anim_container"><div class="wBall" id="wBall_1"><div class="wInnerBall"></div></div><div class="wBall" id="wBall_2"><div class="wInnerBall"></div></div><div class="wBall" id="wBall_3"><div class="wInnerBall"></div></div><div class="wBall" id="wBall_4"><div class="wInnerBall"></div></div><div class="wBall" id="wBall_5"><div class="wInnerBall"></div></div></div>';
        this.containerEl.appendChild(_el);

        _el = this.messageEl = document.createElement("div");
        _el.className = "ojs_wait_screen_message";
        this.containerEl.appendChild(_el);

        _el = this.progressFrameEl = document.createElement("div");
        _el.className = "ojs_wait_screen_progress_bar_frame";
        this.containerEl.appendChild(_el);

        _el = this.progressEl = document.createElement("div");
        _el.className = "ojs_wait_screen_progress_bar";
        _el.style.width = "0%";
        this.progressFrameEl.appendChild(_el);

        this.outerFrameTransitionDriver.setCustomTransitionClasses({
            standyStateClass: "ojs_wait_screen_standy_state",
            enterTransitionClass: "ojs_wait_screen_enter_transition",
            leaveTransitionClass: "ojs_wait_screen_leave_transition",
            endStateClass: "ojs_wait_screen_end_state"
        });
    }

    public load(isModal: boolean, params?: any, options?: OverlayOptions): Promise<Result> {
        let msg = "", disp = "none", p = 0;
        
        if (params) {
            msg = params.message ? params.message : "";
            disp = params.showProgressBar ? "block" : "none";
            if (!isNaN(params.progressRatio)) {
                let p = params.progressRatio;
                if (p < 0) {
                    p = 0;
                } else if (p > 1) {
                    p = 1;
                }
            }
            
        }

        this.messageEl.innerHTML = msg;
        this.progressFrameEl.style.display = disp;
        this.progressEl.style.width = Math.round(p * 100) + "%";

        this.outerFrameTransitionDriver.show();

        return this.waitForOverlayClose();
    }

    public onReceiveMessage(data: any, sender: Overlay): Promise<Result> {
        return Promise.resolve(Result.ok());
    }

}