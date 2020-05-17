/*

    overlay.js - iframeClient

    Copyright (c) 2020 Ryota Takaki

    This software is released under the MIT License.
    http://opensource.org/licenses/mit-license.php

*/

if (window.navigator.userAgent.toLowerCase().indexOf("msie") !== -1 || window.navigator.userAgent.toLowerCase().indexOf("trident") !== -1) {
    "function"!=typeof Object.assign&&Object.defineProperty(Object,"assign",{value:function(d,f){if(null==d)throw new TypeError("Cannot convert undefined or null to object");for(var e=Object(d),b=1;b<arguments.length;b++){var a=arguments[b];if(null!=a)for(var c in a)Object.prototype.hasOwnProperty.call(a,c)&&(e[c]=a[c])}return e},writable:!0,configurable:!0});
}

if (window !== window.parent) {

    if (!window.Overlayjs) window.Overlayjs = {};

    Overlayjs.receiveMessageEventListener = function() {};

    Overlayjs.awaitCallTable = {};

    Overlayjs.pendingFunctions = [];
    Overlayjs.pendingFunctionsArguments = [];

    Overlayjs.MessageDialogMode = {
        INFO: 0,
        SUCCESS: 1,
        ALERT: 2,
        ERROR: 3,
        CONFIRM: 10,
        CONFIRM_CAUTION: 11,
        CONFIRM_DELETE: 12,
    };

    Overlayjs.getIFrameId = function() {
        return window.Overlayjs.iframeId;
    }

    window.addEventListener("message", function(e) {
        const data = e.data;
        switch (data.command) {
            case "dispatchIFrameId":
                Overlayjs.iframeId = data.params;

                for (let i = 0; i < Overlayjs.pendingFunctions.length; i++) {
                    Overlayjs.pendingFunctions[i].apply(this, Overlayjs.pendingFunctionsArguments[i]);
                }
                Overlayjs.pendingFunctions = [];
                Overlayjs.pendingFunctionsArguments = [];
                break;
            case "headerCloseButtonClicked":
                if (window["onCloseRequest"]) {
                    if (window.onCloseRequest()) Overlayjs.cancelAndClose();
                } else {
                    Overlayjs.cancelAndClose();
                }
                break;
            case "receiveMessage":
                Overlayjs.receiveMessageEventListener(data.params);
                break;
            case "return":
                Overlayjs.resolveAwait(data.sender, data.params);
                break;
        }
    });

    Overlayjs.registerAwait = function(overlayName, promiseResolver) {
        Overlayjs.awaitCallTable[overlayName] = promiseResolver;
    }

    Overlayjs.resolveAwait = function(overlayName, returnValue) {
        const obj = Overlayjs.awaitCallTable[overlayName];
        if (returnValue.isOk) {
            obj.resolve(returnValue);
        } else {
            obj.reject();
        }
        
        delete Overlayjs.awaitCallTable[overlayName];
    }
    
    Overlayjs.tryAndPendPostMessage = function(func, args) {
    	if (!Overlayjs.getIFrameId()) {
    		Overlayjs.pendingFunctions.push(func);
    		Overlayjs.pendingFunctionsArguments.push(args);
    		return false;
    	}
    	return true;
    }

    Overlayjs.sendMessage = function(destination, data) {
    	if (!Overlayjs.tryAndPendPostMessage(Overlayjs.sendMessage, arguments)) return;
    	
        window.parent.postMessage({
            destination: destination,
            params: data,
            sender: Overlayjs.getIFrameId(),
            listenerClass: "OverlayManager"
        }, "*");
    }

    Overlayjs.broadcastMessage = function(data) {
    	if (!Overlayjs.tryAndPendPostMessage(Overlayjs.broadcastMessage, arguments)) return;
    	
        window.parent.postMessage({
            destination: "*",
            params: data,
            sender: Overlayjs.getIFrameId(),
            listenerClass: "OverlayManager"
        }, "*");   
    }

    Overlayjs.changeWindowCaption = function(caption) {
    	if (!Overlayjs.tryAndPendPostMessage(Overlayjs.changeWindowCaption, arguments)) return;
    	
        window.parent.postMessage({
            command: "changeWindowCaption",
            params: {caption: caption},
            sender: Overlayjs.getIFrameId(),
            listenerClass: "IFrameWindow"
        }, "*");
    }

    Overlayjs.returnAndClose = function(data) {
    	if (!Overlayjs.tryAndPendPostMessage(Overlayjs.returnAndClose, arguments)) return;
    	
        window.parent.postMessage({
            command: "ok",
            params: data,
            sender: Overlayjs.getIFrameId(),
            listenerClass: "IFrameWindow"
        }, "*");
    }

    Overlayjs.cancelAndClose = function() {
    	if (!Overlayjs.tryAndPendPostMessage(Overlayjs.cancelAndClose, arguments)) return;
    	
        window.parent.postMessage({
            command: "cancel",
            sender: Overlayjs.getIFrameId(),
            listenerClass: "IFrameWindow"
        }, "*");
    }

    Overlayjs._open = function(name, command, params, openConfig) {
    	if (!Overlayjs.tryAndPendPostMessage(Overlayjs._open, arguments)) return;

        const promise = new Promise(function(resolve, reject) {
            Overlayjs.registerAwait(name, { resolve: resolve, reject: reject });
        });

        var postMsgParams = {
            name: name,
            loadParams: params,
            openConfig: openConfig
        }

        window.parent.postMessage({
            command: command,
            params: postMsgParams,
            sender: Overlayjs.getIFrameId(),
            listenerClass: "IFrameWindow"
        }, "*");

        return promise;    
    }

    Overlayjs.open = function(name, params, openConfig) {
        return Overlayjs._open(name, "open", params, openConfig);
    }

    Overlayjs.openAsModal = function(name, params, openConfig) {
        return Overlayjs._open(name, "openAsModal", params, openConfig);
    }

    Overlayjs.openNewIFrameWindow = function(name, url, openConfig) {
        return Overlayjs._open(name, "openNewIFrameWindow", {url: url}, openConfig);
    }

    Overlayjs.openNewIFrameWindowAsModal = function(name, url, openConfig) {
        return Overlayjs._open(name, "openNewIFrameWindowAsModal", {url: url}, openConfig);
    }

    Overlayjs.showLoadingOverlay = function(message, showProgressBar, progressRatio) {
        return Overlayjs._open("waitScreen", "showLoadingOverlay", {
            message: message,
            showProgressBar: showProgressBar,
            progressRatio: progressRatio,
        });
    }

    Overlayjs.hideLoadingOverlay = function() {
        Overlayjs._open("waitScreen", "hideLoadingOverlay");
    }
}