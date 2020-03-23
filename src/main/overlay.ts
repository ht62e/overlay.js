/*

    overlay.js

    Copyright (c) 2020 Ryota Takaki

    This software is released under the MIT License.
    http://opensource.org/licenses/mit-license.php

*/

import Common from "./core/common/common";
import OverlayManager, { OverlayConfig } from "./core/overlay/overlay_manager";
import ContextMenu, { ContextMenuOptions } from "./core/overlay/context_menu";
import Drawer, { DrawerOptions } from "./core/overlay/drawer";
import Overlay from "./core/overlay/overlay";
import IFrameWindow from "./core/overlay/iframe_window";
import MessageDialog, { MessageDialogMode } from "./core/overlay/message_dialog";
import LoadingOverlay from "./core/overlay/loading_overlay";

//Webpack UMD形式バンドルにおいてimportしたモジュールが公開されない挙動への対応
export { 
    OverlayManager, ContextMenu, Drawer, IFrameWindow, MessageDialog,
    LoadingOverlay as WaitScreen, MessageDialogMode
}

var __overlayjsBootstrap = function() {
    const global = window as any;

    //開発用エクスポート処理
    if (!global.Overlayjs) {
        const ojs: any = global.Overlayjs = {};
        ojs.OverlayManager = OverlayManager;
        ojs.Overlay = Overlay;
        ojs.IFrameWindow = IFrameWindow;
        ojs.MessageDialog = MessageDialog;
        ojs.WaitScreen = LoadingOverlay;
        ojs.ContextMenu = ContextMenu;
        ojs.Drawer = Drawer;
    }

    if (global.overlayjsInitializer) {
        global.overlayjsInitializer();
    }
}

if (document["documentMode"]) {
    Common.isMsIE = true;
}

window.addEventListener("mousemove", (e: MouseEvent) => {
    Common.currentMouseClientX = e.clientX;
    Common.currentMouseClientY = e.clientY;
});


var __embedSvgImage = function() {
    let s = "";
    s += '<svg aria-hidden="true" style="position: absolute; width: 0; height: 0; overflow: hidden;" id="" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg">';
    s +=    '<symbol id="message-dialog-check-icon" viewBox="0 0 24 24">';
    s +=        '<path d="M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M12 20C7.59 20 4 16.41 4 12S7.59 4 12 4 20 7.59 20 12 16.41 20 12 20M16.59 7.58L10 14.17L7.41 11.59L6 13L10 17L18 9L16.59 7.58Z" />';
    s +=    '</symbol>';
    s +=    '<symbol id="message-dialog-exclamation-icon" viewBox="0 0 24 24">';
    s +=        '<path d="M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z" />';
    s +=    '</symbol>';
    s +=    '<symbol id="message-dialog-cross-icon" viewBox="0 0 24 24">';
    s +=        '<path d="M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2C6.47,2 2,6.47 2,12C2,17.53 6.47,22 12,22C17.53,22 22,17.53 22,12C22,6.47 17.53,2 12,2M14.59,8L12,10.59L9.41,8L8,9.41L10.59,12L8,14.59L9.41,16L12,13.41L14.59,16L16,14.59L13.41,12L16,9.41L14.59,8Z" />';
    s +=    '</symbol>';
    s += '</svg>';

    let svgRoot: HTMLDivElement = document.createElement("div");
    svgRoot.innerHTML = s;
    document.body.appendChild(svgRoot);
}

if (document.readyState === "complete") {
    __overlayjsBootstrap();
    __embedSvgImage();
} else {
    window.addEventListener("load", () => {
        __overlayjsBootstrap();
        __embedSvgImage();
    });
}