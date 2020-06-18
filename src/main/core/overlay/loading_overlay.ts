import Overlay, { OverlayOptions } from "./overlay";
import { Result } from "../common/dto";
import { CssSize } from "../common/types";
import WaitScreen from "../common/wait_screen";

export default class LoadingOverlay extends Overlay {
    public static DEFAULT_NAME: string = "_default_wait_screen";

    protected waitScreen: WaitScreen;

    constructor() {
        const options: OverlayOptions = {
            size: new CssSize("100%", "100%"),
            subOverlay: true,
            allowToOverrideAlreadyOpened: true
        };
        super(LoadingOverlay.DEFAULT_NAME, options);

        this.frameEl.style.left = "0px";
        this.frameEl.style.top = "0px";

        this.waitScreen = new WaitScreen();

        this.containerEl.appendChild(this.waitScreen.getScreenElement());

        this.frameEl.classList.remove("ojs_default_overlay_frame");
        this.frameEl.classList.add("ojs_wait_screen_frame");
    }

    public load(isModal: boolean, params?: any): Promise<Result> {
        this.waitScreen.showWithoutTransition(params.message, params.showProgressBar, params.progressRatio);
        this.outerFrameTransitionDriver.show();
        return this.waitForOverlayClose();
    }

    public onReceiveMessage(data: any, sender: Overlay): Promise<Result> {
        return Promise.resolve(Result.ok());
    }

}