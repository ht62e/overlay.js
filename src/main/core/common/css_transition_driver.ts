import Common from "./common";

export interface CssTransitionDriverClasses {
    standyStateClass?: string;
    enterTransitionClass?: string;
    leaveTransitionClass?: string;
    endStateClass?: string;
}

export default class CssTransitionDriver {
    private static ANIMATION_APPLYING_DELAY_TIME: number = 20;

    private target: HTMLElement;
    private standbyStateClass: string = "standy_state";
    private enterTransitionClass: string = "enter_transition";
    private leaveTransitionClass: string = "leave_transition";
    private endStateClass: string = "end_state";

    private initialCssDisplay: string = "";

    private showEventHandlers: (() => void)[] = [];

    private showPromise: Promise<boolean>;   
    private hidePromise: Promise<boolean>;
    private showResolver: (value?: boolean | PromiseLike<boolean>) => void = null;
    private hideResolver: (value?: boolean | PromiseLike<boolean>) => void = null;
    
    constructor(target: HTMLElement, customClasses?: CssTransitionDriverClasses) {
        this.target = target;
        if (target.style.display !== "none") {
            this.initialCssDisplay = target.style.display;
        }
        if (target.style.visibility !== "hidden") {
            target.style.display = "none";
        }
        this.setCustomTransitionClasses(customClasses);

        target.addEventListener("transitionend", this.onTransitionEnd.bind(this));
    }

    protected onTransitionEnd(event: AnimationEvent) {
        if (this.hidePromise) {
            this.setStandbyStateClasses();
            this.hidePromise = null;
            this.hideResolver(true);
        }
        if (this.showPromise) {
            this.showPromise = null;
            this.showResolver(true);
        }        
    }

    public addShowEventHandler(handler: () => void) {
        this.showEventHandlers.push(handler);
    }

    public setCustomTransitionClasses(classes: CssTransitionDriverClasses): void {
        if (classes) {
            if (classes.standyStateClass !== undefined) {
                this.target.classList.remove(this.standbyStateClass);
                this.standbyStateClass = classes.standyStateClass;
            }
            if (classes.enterTransitionClass !== undefined) {
                this.target.classList.remove(this.enterTransitionClass);
                this.enterTransitionClass = classes.enterTransitionClass;
            }
            if (classes.leaveTransitionClass !== undefined) {
                this.target.classList.remove(this.leaveTransitionClass);
                this.leaveTransitionClass = classes.leaveTransitionClass;
            }
            if (classes.endStateClass !== undefined) {
                this.target.classList.remove(this.endStateClass);
                this.endStateClass = classes.endStateClass;
            }
        }

        if (this.target.style.display === "none" || this.target.style.visibility === "hidden") {
            this.target.classList.add(this.standbyStateClass);
        }
    }

    public async show(withoutTransition?: boolean): Promise<boolean> {
        if (this.hidePromise) {
            //クローズアニメーション中に再表示した場合においても、hide呼び出し元には閉じたことを通知する
            this.hidePromise = null;
            this.hideResolver(true);
        }
        
        const transitionIsUsed = this.toggleClasses(true, withoutTransition);
        
        if (transitionIsUsed) {
            if (this.showPromise) {
                return this.showPromise;
            } else {
                return this.showPromise = new Promise(resolve => {
                    this.showResolver = resolve;
                });
            }
        } else {
            return Promise.resolve(true);
        }
    }

    public async hide(withoutTransition?: boolean): Promise<boolean> {
        if (Common.isMsIE) withoutTransition = true; //IEバグ対策
        if (this.target.style.display === "none" || this.target.style.visibility === "hidden") return;
        
        if (this.showPromise) {
            this.showPromise = null;
            this.showResolver(true);
        }

        const transitionIsUsed = this.toggleClasses(false, withoutTransition);

        if (transitionIsUsed) {
            if (this.hidePromise) {
                return this.hidePromise;
            } else {
                return this.hidePromise = new Promise(resolve => {
                    this.hideResolver = resolve;
                });
            }
        } else {
            this.setStandbyStateClasses();
            return Promise.resolve(true);
        }
    }

    protected toggleClasses(visible: boolean, withoutTransition?: boolean): boolean {
        let transitionIsUsed: boolean = true;

        const _t = this.target;

        if (visible) {
            _t.style.display = this.initialCssDisplay;
            _t.style.visibility = ""; //初回表示まではvisibility:hiddenで非表示状態になっている
            _t.style.opacity = "";

            //CSSのdisplayの解除と共にCSSクラスを適用するとアニメーションが実行されないため少し遅らせる（なお遅れ0でも不安定）
            window.setTimeout(() => {
                _t.style.pointerEvents = "";
                if (this.enterTransitionClass && !withoutTransition) {
                    _t.classList.add(this.enterTransitionClass);
                } else {
                    transitionIsUsed = false;
                }
                if (this.standbyStateClass) {
                    _t.classList.remove(this.standbyStateClass);
                }
                if (this.leaveTransitionClass) {
                    _t.classList.remove(this.leaveTransitionClass);
                }
                if (this.endStateClass) {
                    _t.classList.remove(this.endStateClass);
                }  
                this.showEventHandlers.forEach(handler => {
                    handler();
                });
            }, withoutTransition ? 0 : CssTransitionDriver.ANIMATION_APPLYING_DELAY_TIME);
        } else {
            window.setTimeout(() => {
                _t.style.pointerEvents = "none";
                if (this.standbyStateClass) {
                    _t.classList.remove(this.standbyStateClass);
                }
                if (this.enterTransitionClass) {
                    _t.classList.remove(this.enterTransitionClass);
                }
                if (this.leaveTransitionClass && !withoutTransition) {
                    _t.classList.add(this.leaveTransitionClass);
                } else {
                    _t.style.display = "none";
                    transitionIsUsed = false;
                }
                if (this.endStateClass) {
                    _t.classList.add(this.endStateClass);
                }
            }, withoutTransition ? 0 : CssTransitionDriver.ANIMATION_APPLYING_DELAY_TIME);
        }

        return transitionIsUsed;
    }

    protected setStandbyStateClasses(): void {
        const _t = this.target;
        _t.style.display = "none";
        _t.style.opacity = "0";

        if (this.standbyStateClass) {
            _t.classList.add(this.standbyStateClass);
        }
        if (this.leaveTransitionClass) {
            _t.classList.remove(this.leaveTransitionClass)
        }
        if (this.endStateClass) {
            _t.classList.remove(this.endStateClass)
        }
    }
}

