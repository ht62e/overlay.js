import Overlay, { OverlayOptions } from "./overlay";
import { Result } from "../common/dto";

const MessageDialogMode: any = {};
export {MessageDialogMode};

export interface MessageDialogOptions extends OverlayOptions {
    caption?: string;
}

export default class MessageDialog extends Overlay {
    public static INFO: number = 0;
    public static SUCCESS: number = 1;
    public static ALERT: number = 2;
    public static ERROR: number = 3;
    public static CONFIRM: number = 10;
    public static CONFIRM_CAUTION: number = 11;
    public static CONFIRM_DELETE: number = 12;

    public static FOCUS_DELAY_TIME_FOR_FOOTER_BUTTONS: number = 300;
   
    public static DEFAULT_DIALOG_CSS_WIDTH = "500px";

    public static OK_BUTTON_DOM_ID = "ojs_active_message_dialog_ok_button";
    public static CANCEL_BUTTON_DOM_ID = "ojs_active_message_dialog_cancel_button";

    protected headerAreaEl: HTMLDivElement;
    protected iconEl: HTMLDivElement;
    protected titleEl: HTMLDivElement;
    
    protected bodyAreaEl: HTMLDivElement;

    protected footerAreaEl: HTMLDivElement;
    protected okButtonEl: HTMLInputElement;
    protected cancelButtonEl: HTMLInputElement;

    protected containerInitialCssClasses: string;

    private focusTargetElAfterShow: HTMLElement;    

    constructor(name: string, options?: MessageDialogOptions) {
        let opt = options ? options : {};
        if (opt.fixPositionToCenterOfViewPort === undefined) opt.fixPositionToCenterOfViewPort = true;

        if (!(opt.size && opt.size.cssHeight)) {
            opt.size = {
                cssWidth: MessageDialog.DEFAULT_DIALOG_CSS_WIDTH,
                cssHeight: "auto"
            };
        }
        super(name, opt);

        this.autoHeight = (!options || !options.size || !options.size.cssHeight) ;

        MessageDialogMode["INFO"] = MessageDialog.INFO;
        MessageDialogMode["SUCCESS"] = MessageDialog.SUCCESS;
        MessageDialogMode["ALERT"] = MessageDialog.ALERT;
        MessageDialogMode["ERROR"] = MessageDialog.ERROR;
        MessageDialogMode["CONFIRM"] = MessageDialog.CONFIRM;
        MessageDialogMode["CONFIRM_CAUTION"] = MessageDialog.CONFIRM_CAUTION;
        MessageDialogMode["CONFIRM_DELETE"] = MessageDialog.CONFIRM_DELETE;

        this.containerEl.classList.add("ojs_message_dialog_container", "ojs_overlay_border_radius");
        this.containerInitialCssClasses = this.containerEl.className;
        this.containerEl.style.display = "flex";
        this.containerEl.style.flexDirection = "column";

        let _area: HTMLDivElement, _el: HTMLDivElement;
       
        //ヘッダエリア
        _area = this.headerAreaEl = document.createElement("div");
        _area.className = "ojs_message_dialog_header_area";
        _area.style.position = "relative";
        _area.style.display = "flex";
        _area.style.flexGrow = "0";
        _area.style.flexShrink = "0";

        _el = this.iconEl = document.createElement("div");
        _el.className = "ojs_message_dialog_icon_wrapper";
        _el.style.flexGrow = "0";
        _el.style.flexShrink = "0";
        _area.appendChild(_el);

        _el = this.titleEl = document.createElement("div");
        _el.className = "ojs_message_dialog_title";
        _el.style.flexGrow = "1";
        _el.style.flexShrink = "1";
        _area.appendChild(_el);

        this.containerEl.appendChild(_area);
        
        //メッセージ領域
        _area = this.bodyAreaEl = document.createElement("div");
        _area.style.flexGrow = "1";
        _area.className = "ojs_message_dialog_message";

        this.containerEl.appendChild(_area);

        //フッター領域
        _area = this.footerAreaEl = document.createElement("div");
        _area.className = "ojs_message_dialog_footer";
        _area.style.position = "relative";
        _area.style.flexGrow = "0";
        _area.style.flexShrink = "0";

        let _ok: HTMLInputElement, _cancel: HTMLInputElement;
        _ok = this.okButtonEl = document.createElement("input");
        _ok.type = "button";
        _ok.className = "ojs_message_dialog_button ok";
        _cancel = this.cancelButtonEl = document.createElement("input");
        _cancel.type = "button";
        _cancel.className = "ojs_message_dialog_button cancel";

        this.attachEventListener(_ok, "click", this.onOkButtonClick);
        this.attachEventListener(_cancel, "click", this.onCancelButtonClick);

        _area.appendChild(_ok);
        _area.appendChild(_cancel);
        this.containerEl.appendChild(_area);

    }

    protected onOkButtonClick(e: MouseEvent): void {
        this.close({
            isOk: true
        })
    }
    
    protected onCancelButtonClick(e: MouseEvent): void {
        this.close({
            isOk: false
        })
    }

    //Override
    protected onShowAfter(): void {
        super.onShowAfter();
        window.setTimeout(() => {
            if (this.focusTargetElAfterShow) {
                this.focusTargetElAfterShow.focus();
            }
        }, MessageDialog.FOCUS_DELAY_TIME_FOR_FOOTER_BUTTONS);
    }


    public load(isModal: boolean, params?: any): Promise<Result> {
        let mode = MessageDialog.INFO;
        
        let title = "";
        let message = "";
        let okButtonLabel = "はい";
        let cancelButtonLabel = "いいえ";

        if (params) {
            const p = params;
            mode = p.mode !== undefined ? p.mode : mode;
            title = p.title ? p.title : "";
            message = p.message ? p.message : "";
            if (p.okButtonLabel) okButtonLabel = p.okButtonLabel;
            if (p.cancelButtonLabel) cancelButtonLabel = p.cancelButtonLabel;
        }

        this.titleEl.innerHTML = title;
        this.bodyAreaEl.innerHTML = message;

        let colorCssName = "";

        this.focusTargetElAfterShow = this.okButtonEl;

        switch (mode) {
            case MessageDialog.INFO:
                colorCssName = "md_info";
                this.iconEl.innerHTML = '<svg class="ojs_message_dialog_icon"><use xlink:href="#ojs-message-dialog-information-icon" style="pointer-events: none;"></use></svg>';
                okButtonLabel = "閉じる";
                this.cancelButtonEl.style.display = "none";
                break;
            case MessageDialog.SUCCESS:
                colorCssName = "md_success";
                this.iconEl.innerHTML = '<svg class="ojs_message_dialog_icon"><use xlink:href="#ojs-message-dialog-check-icon" style="pointer-events: none;"></use></svg>';
                okButtonLabel = "閉じる";
                this.cancelButtonEl.style.display = "none";
                break;
            case MessageDialog.ALERT:
                colorCssName = "md_alert";
                this.iconEl.innerHTML = '<svg class="ojs_message_dialog_icon"><use xlink:href="#ojs-message-dialog-exclamation-icon" style="pointer-events: none;"></use></svg>';
                okButtonLabel = "閉じる";
                this.cancelButtonEl.style.display = "none";
                break;
            case MessageDialog.ERROR:
                colorCssName = "md_critical";
                this.iconEl.innerHTML = '<svg class="ojs_message_dialog_icon"><use xlink:href="#ojs-message-dialog-cross-icon" style="pointer-events: none;"></use></svg>';
                okButtonLabel = "閉じる";
                this.cancelButtonEl.style.display = "none";
                break;
            case MessageDialog.CONFIRM:
                colorCssName = "md_info";
                this.iconEl.innerHTML = '<svg class="ojs_message_dialog_icon"><use xlink:href="#ojs-message-dialog-exclamation-icon" style="pointer-events: none;"></use></svg>';
                this.cancelButtonEl.style.display = "block";
                break;
            case MessageDialog.CONFIRM_CAUTION:
                colorCssName = "md_alert";
                this.iconEl.innerHTML = '<svg class="ojs_message_dialog_icon"><use xlink:href="#ojs-message-dialog-exclamation-icon" style="pointer-events: none;"></use></svg>';
                this.cancelButtonEl.style.display = "block";
                this.focusTargetElAfterShow = null;
                break;
            case MessageDialog.CONFIRM_DELETE:
                colorCssName = "md_critical";
                this.iconEl.innerHTML = '<svg class="ojs_message_dialog_icon md_confirm_delete"><use xlink:href="#ojs-message-dialog-exclamation-icon" style="pointer-events: none;"></use></svg>';
                this.cancelButtonEl.style.display = "block";
                this.focusTargetElAfterShow = null;
                break;
        }

        if (params) {
            const p = params;
            if (p.okButtonLabel) okButtonLabel = p.okButtonLabel;
            if (p.cancelButtonLabel) cancelButtonLabel = p.cancelButtonLabel;
        }

        this.okButtonEl.value = okButtonLabel;
        this.cancelButtonEl.value = cancelButtonLabel;

        this.containerEl.className = this.containerInitialCssClasses;
        this.containerEl.classList.add(colorCssName);

        this.shrinkWidthToMaximum();
        this.moveToViewPortCenter();

        this.outerFrameTransitionDriver.show();

        return this.waitForOverlayClose();
    }

    public onReceiveMessage(data: any, sender: Overlay): Promise<Result> {
        return Promise.resolve<Result>(null);
    }

    //Override
    public onViewPortResize(viewPortWidth: number, viewPortHeight: number) {
        this.shrinkWidthToMaximum();
        super.onViewPortResize(viewPortWidth, viewPortHeight);
    }

    //override
    public activate(isFront: boolean): void {
        super.activate(isFront);

        //テスティングフレームワーク用にアクティブなダイアログボタンにID属性を付与する
        this.okButtonEl.setAttribute("id", MessageDialog.OK_BUTTON_DOM_ID);
        this.cancelButtonEl.setAttribute("id", MessageDialog.CANCEL_BUTTON_DOM_ID);
    }

    //override
    public inactivate(withModal: boolean): void {
        super.inactivate(withModal);

        //テスティングフレームワーク用に付与したダイアログボタンのID属性を削除
        this.okButtonEl.removeAttribute("id");
        this.cancelButtonEl.removeAttribute("id");
    }

    protected shrinkWidthToMaximum() {

        const ratio: number = this.options.maxWidthRatioOfViewPort ? this.options.maxWidthRatioOfViewPort : Overlay.DEFAULT_MAX_OVERLAY_WIDTH_RATIO_OF_VIEWPORT;
        const viewPortWidth = this.viewPortEl.offsetWidth;
        const maxWidth: number = Math.round(viewPortWidth * ratio);
        const initialWidth = this.originalSizePx.width;

        let finalWidth = initialWidth + "px";
        if (initialWidth > maxWidth) {
            finalWidth = maxWidth + "px";
        }

        this.resize(finalWidth, this.currentSize.cssHeight);
    }


}