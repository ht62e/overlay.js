/*

    overlay.js - client

    Copyright (c) 2020 Ryota Takaki

    This software is released under the MIT License.
    http://opensource.org/licenses/mit-license.php

*/

if (window.navigator.userAgent.toLowerCase().indexOf("msie") !== -1 || window.navigator.userAgent.toLowerCase().indexOf("trident") !== -1) {
    "function"!=typeof Object.assign&&Object.defineProperty(Object,"assign",{value:function(d,f){if(null==d)throw new TypeError("Cannot convert undefined or null to object");for(var e=Object(d),b=1;b<arguments.length;b++){var a=arguments[b];if(null!=a)for(var c in a)Object.prototype.hasOwnProperty.call(a,c)&&(e[c]=a[c])}return e},writable:!0,configurable:!0});
}

if (!window.OjsClient) window.OjsClient = {};

window.addEventListener("load", function() {
    OjsClient.firedOnLoadEvent = true;
});

(function() {
    let parent = window.parent;
    while (!(parent.Overlayjs && parent.Overlayjs.isHost) && parent.parent !== parent) {
        parent = parent.parent;
    }
    window.OjsClient.hostContext = parent;
})();

OjsClient.receiveMessageEventListener = function() {};

OjsClient.awaitCallTable = {};

OjsClient.pendingCallers = [];

OjsClient.MessageDialogMode = {
    INFO: 0,
    SUCCESS: 1,
    ALERT: 2,
    ERROR: 3,
    CONFIRM: 10,
    CONFIRM_CAUTION: 11,
    CONFIRM_DELETE: 12,
};

OjsClient.getFrameId = function() {
    return window.OjsClient.frameId;
}

window.addEventListener("message", function(e) {
    const data = e.data;
    switch (data.command) {
        case "dispatchConfig":
            OjsClient.frameId = data.params.frameId;
            OjsClient.runAllPendingCallers();
            if (OjsClient.onload) OjsClient.onload(data.params.loadParams);
            break;
        case "headerCloseButtonClicked":
            if (window["onCloseRequest"]) {
                if (window.onCloseRequest()) OjsClient.cancelAndClose();
            } else {
                OjsClient.cancelAndClose();
            }
            break;
        case "receiveMessage":
            OjsClient.receiveMessageEventListener(data.params);
            break;
        case "return":
            OjsClient.resolvePromiseTrigger(data.sender, data.params);
            break;
    }
});

OjsClient.addPromiseTrigger = function(overlayName, promiseResolve, promiseReject) {
    if (!OjsClient.awaitCallTable[overlayName]) {
        OjsClient.awaitCallTable[overlayName] = []; 
    }
    OjsClient.awaitCallTable[overlayName].push({
        resolve: promiseResolve,
        reject: promiseReject
    });
}

OjsClient.resolvePromiseTrigger = function(overlayName, returnValue) {
    const trigger = OjsClient.awaitCallTable[overlayName].shift();
    if (returnValue.isOk) {
        trigger.resolve(returnValue);
    } else {
        trigger.reject();
    }
}

OjsClient.runAllPendingCallers = function() {
    const initCallerCount = OjsClient.pendingCallers.length;
    for (let i = 0; i < OjsClient.pendingCallers.length; i++) {
        OjsClient.pendingCallers[i]["func"].apply(this, 
            OjsClient.pendingCallers[i]["args"],
            OjsClient.pendingCallers[i]["promiseResolve"],
            OjsClient.pendingCallers[i]["promiseReject"]
        );
    }
    OjsClient.pendingCallers.splice(0, initCallerCount);
}

OjsClient.pendPostMessage = function(func, args, promiseResolve, promiseReject) {
    OjsClient.pendingCallers.push({
        func: func, args: args, promiseResolve: promiseResolve, promiseReject: promiseReject
    });
}

OjsClient.tryAndPendPostMessage = function(func, args, promiseResolve, promiseReject) {
    if (!OjsClient.getFrameId()) {            
        OjsClient.pendingCallers.push({
            func: func, args: args, promiseResolve: promiseResolve, promiseReject: promiseReject
        });

        return false;
    }
    return true;
}

OjsClient.sendMessage = function(destination, data) {
    if (!OjsClient.tryAndPendPostMessage(OjsClient.sendMessage, arguments)) return;
    
    window.OjsClient.hostContext.postMessage({
        command: "sendMessage",
        destination: destination,
        params: data,
        sender: OjsClient.getFrameId()
    }, "*");
}

OjsClient.broadcastMessage = function(data) {
    if (!OjsClient.tryAndPendPostMessage(OjsClient.broadcastMessage, arguments)) return;
    
    window.OjsClient.hostContext.postMessage({
        command: "broadcastMessage",
        destination: "*",
        params: data,
        sender: OjsClient.getFrameId()
    }, "*");   
}

OjsClient.changeWindowCaption = function(caption) {
    if (!OjsClient.tryAndPendPostMessage(OjsClient.changeWindowCaption, arguments)) return;
    
    window.OjsClient.hostContext.postMessage({
        command: "changeWindowCaption",
        params: {caption: caption},
        sender: OjsClient.getFrameId()
    }, "*");
}

OjsClient.returnAndClose = function(data) {
    if (!OjsClient.tryAndPendPostMessage(OjsClient.returnAndClose, arguments)) return;
    
    window.OjsClient.hostContext.postMessage({
        command: "ok",
        params: data,
        sender: OjsClient.getFrameId()
    }, "*");
}

OjsClient.cancelAndClose = function() {
    if (!OjsClient.tryAndPendPostMessage(OjsClient.cancelAndClose, arguments)) return;
    
    window.OjsClient.hostContext.postMessage({
        command: "cancel",
        sender: OjsClient.getFrameId()
    }, "*");
}

OjsClient.close = function(name) {
    if (!OjsClient.tryAndPendPostMessage(OjsClient.close, arguments)) return;
    
    window.OjsClient.hostContext.postMessage({
        command: "close",
        sender: OjsClient.getFrameId(),
        params: {
            name: name
        }
    }, "*");
}

OjsClient._open = function(name, command, params, openConfig, _promiseResolve, _promiseReject) {
    let promise = null;
    let promiseResolve, promiseReject;

    if (_promiseResolve) {
        promiseResolve = _promiseResolve;
        promiseReject = _promiseReject;
    } else {
        promise = new Promise(function(resolve, reject) {
            promiseResolve = resolve;
            promiseReject = reject;
        });
    }

    //FrameID未割当時に対する待機
    if (!OjsClient.tryAndPendPostMessage(OjsClient._open, arguments, promiseResolve, promiseReject)) {
        return promise;
    }

    var postMsgParams = {
        name: name,
        loadParams: params,
        openConfig: openConfig
    }

    OjsClient.addPromiseTrigger(name, promiseResolve, promiseReject);

    window.OjsClient.hostContext.postMessage({
        command: command,
        params: postMsgParams,
        sender: OjsClient.getFrameId()
    }, "*");

    return promise;    
}

OjsClient.open = function(name, params, openConfig) {
    return OjsClient._open(name, "open", params, openConfig);
}

OjsClient.openAsModal = function(name, params, openConfig) {
    return OjsClient._open(name, "openAsModal", params, openConfig);
}

OjsClient.openLinkInNewWindow = function(name, url, params, openConfig) {
    const loadParams = Object.assign({url: url}, params);
    return OjsClient._open(name, "openNewIFrameWindow", loadParams, openConfig);
}

OjsClient.openLinkInNewModalWindow = function(name, url, params, openConfig) {
    const loadParams = Object.assign({url: url}, params);
    return OjsClient._open(name, "openNewIFrameWindowAsModal", loadParams, openConfig);
}

OjsClient.showLoadingOverlay = function(message, showProgressBar, progressRatio) {
    window.OjsClient.hostContext.postMessage({
        command: "showLoadingOverlay",
        params: {
            message: message,
            showProgressBar: showProgressBar,
            progressRatio: progressRatio
        },
        sender: OjsClient.getFrameId()
    }, "*");
}

OjsClient.hideLoadingOverlay = function() {
    window.OjsClient.hostContext.postMessage({
        command: "hideLoadingOverlay",
        sender: OjsClient.getFrameId()
    }, "*");
}
