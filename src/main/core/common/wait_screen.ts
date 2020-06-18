import CssTransitionDriver from "./css_transition_driver";

export default class WaitScreen {
    protected containerEl: HTMLDivElement;

    protected loadingAnimationEl: HTMLDivElement;
    protected messageEl: HTMLDivElement;
    protected progressFrameEl: HTMLDivElement;
    protected progressEl: HTMLDivElement;

    protected transitionDriver: CssTransitionDriver;
    
    constructor() {
        let _lf: HTMLDivElement;
        _lf = this.containerEl = document.createElement("div");
        _lf.style.position = "absolute"
        _lf.style.left = "0px";
        _lf.style.top = "0px";
        _lf.style.width = "100%";
        _lf.style.height = "100%";
        _lf.style.display = "flex";
        _lf.className = "ojs_wait_screen_container";
        _lf.style.zIndex = "1";
        _lf.style.flexDirection = "column";
        _lf.style.justifyContent = "center";
        _lf.style.alignItems = "center";    

        let _el: HTMLDivElement;
        _el = this.loadingAnimationEl = document.createElement("div");
        _el.innerHTML = '<div class="wball_css_anim_container"><div class="wBall" id="wBall_1"><div class="wInnerBall"></div></div><div class="wBall" id="wBall_2"><div class="wInnerBall"></div></div><div class="wBall" id="wBall_3"><div class="wInnerBall"></div></div><div class="wBall" id="wBall_4"><div class="wInnerBall"></div></div><div class="wBall" id="wBall_5"><div class="wInnerBall"></div></div></div>';
        _lf.appendChild(_el);

        _el = this.messageEl = document.createElement("div");
        _el.className = "ojs_wait_screen_message";
        _lf.appendChild(_el);

        _el = this.progressFrameEl = document.createElement("div");
        _el.className = "ojs_wait_screen_progress_bar_frame";
        _lf.appendChild(_el);

        _el = this.progressEl = document.createElement("div");
        _el.className = "ojs_wait_screen_progress_bar";
        _el.style.width = "0%";
        this.progressFrameEl.appendChild(_el);

        this.transitionDriver = new CssTransitionDriver(this.containerEl);
    }

    public getScreenElement(): HTMLDivElement {
        return this.containerEl;
    }

    public show(message: string, showProgressBar?: boolean, progressRatio?: number): void {
        this.update(message, showProgressBar, progressRatio);
        this.transitionDriver.show()
    }

    public showWithoutTransition(message: string, showProgressBar?: boolean, progressRatio?: number): void {
        this.update(message, showProgressBar, progressRatio);
        this.transitionDriver.show(true);
    }

    public hide() {
        this.transitionDriver.hide();
    }

    public hideWithoutTransition() {
        this.transitionDriver.hide(true);
    }

    public update(message: string, showProgressBar?: boolean, progressRatio?: number): void {
        let msg = "", disp = "none", p = 0;
        
        msg = message ? message : "";
        disp = showProgressBar ? "block" : "none";
        if (!isNaN(progressRatio)) {
            let p = progressRatio;
            if (p < 0) {
                p = 0;
            } else if (p > 1) {
                p = 1;
            }
        }

        this.messageEl.innerHTML = msg;
        this.progressFrameEl.style.display = disp;
        this.progressEl.style.width = Math.round(p * 100) + "%";        
    }
}