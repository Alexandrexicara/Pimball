(function (factory) {
  typeof define === 'function' && define.amd ? define(factory) :
  factory();
})((function () { 'use strict';
  const CODE = {
      OK: "OK",
      UNSUPPORTED_API: "UNSUPPORTED_API",
      TIMEOUT: "TIMEOUT",
      INVALID_PARAM: "INVALID_PARAM",
      NOT_READY: "NOT_READY",
      ADS_NO_FILL: "ADS_NO_FILL",
      AD_LOAD_FAILED: "AD_LOAD_FAILED",
      AD_DISMISSED: "AD_DISMISSED",
      AD_NOT_LOADED: "AD_NOT_LOADED",
      AD_ALREADY_LOADED: "AD_ALREADY_LOADED",
      AD_ALREADY_SHOWED: "AD_ALREADY_SHOWED"
  };
  const API_CODE = {
      CODE: CODE,
      OK: { code: CODE.OK, message: "Success" },
      TIMEOUT: { code: CODE.TIMEOUT, message: "timeout" },
      adLoadFail: { code: CODE.AD_LOAD_FAILED, message: "Ad load failed" },
      adDismissed: { code: CODE.AD_DISMISSED, message: "Ad dismissed" },
      adNotLoaded: { code: CODE.AD_NOT_LOADED, message: "Ad not loaded" },
      adAlreadyLoaded: { code: CODE.AD_ALREADY_LOADED, message: "Ad already loaded" },
      adAlreadyShowed: { code: CODE.AD_ALREADY_SHOWED, message: "Ad already showed" }
  };
  function isSuccess(err) {
      return (err.code === CODE.OK || err.code === undefined || err.code === null || err.code === "");
  }
  function __awaiter(thisArg, _arguments, P, generator) {
      function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
      return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
          function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
          function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
  }
  class MediationService {
      constructor(type, oneWay, serviceHandler) {
          this.type = type;
          this.isOneWay = oneWay;
          this._serviceHandler = serviceHandler;
      }
      onRequest(request) {
          return __awaiter(this, void 0, void 0, function* () {
              if (this._serviceHandler) return this._serviceHandler(request);
              return Promise.resolve({ type: request.type + "_RESPONSE", code: CODE.OK, message: "Success", payload: null });
          });
      }
  }
  function generateResponseType(requestType) { return `${requestType}_RESPONSE`; }
  function generateResponse(request, code, message, payload) { return { type: generateResponseType(request.type), requestType: request.type, requestId: request.requestId, code, message, payload }; }
  function generateSuccessResponse(request, payload) { return generateResponse(request, API_CODE.OK.code, API_CODE.OK.message, payload); }
  function generateErrorResponse(request, code, message, payload) { return generateResponse(request, code, message, payload); }
  class MessageDispatcher {
      constructor(dispatcher) { this._window = dispatcher; this._messageDispatcher = this._onReceiveMessage.bind(this); }
      _onReceiveMessage(event) { try { const m = event.data; if (m && m.type) this.dispatch(m, event.source); } catch(e) {} }
      static postMessageTo(receiver, message, origin = "*") { receiver.postMessage(message, origin); }
      start() { this._window.addEventListener("message", this._messageDispatcher, false); }
      stop() { this._window.removeEventListener("message", this._messageDispatcher, false); }
  }
  class MediationClient extends MessageDispatcher {
      constructor(responseWindow, requestWindow) { super(responseWindow); this._requestCounter = 0; this._pendingRequests = []; this._requestWindow = requestWindow; }
      static createDefaultInstance(serviceWindow) { if (!this._instance) this._instance = new MediationClient(window, serviceWindow); return this._instance; }
      static get instance() { if (!this._instance) throw { code: "NO_CLIENT_INSTANCE", message: "Not initialized" }; return this._instance; }
      dispatch(msg, src) {
          const req = this._pendingRequests.find(r => r.responseType === msg.type && r.requestId === msg.requestId);
          if (req) { this._pendingRequests = this._pendingRequests.filter(r => r !== req); if (req.onResponse) req.onResponse(msg); }
      }
      invokeServiceAsync(req, oneWay = false) {
          return new Promise((resolve, reject) => {
              req.requestId = ++this._requestCounter;
              if (!oneWay) {
                  const p = { responseType: req.responseType || generateResponseType(req.type), requestType: req.type, requestId: req.requestId, onResponse: res => isSuccess(res) ? resolve(res) : reject(res) };
                  this._pendingRequests.push(p);
              }
              MessageDispatcher.postMessageTo(this._requestWindow, req, "*");
          });
      }
      invokeQuickServiceAsync(type, oneWay, payload) { return this.invokeServiceAsync({ type, payload }, oneWay); }
  }
  function newUnsupportAPIError(api) { return { code: CODE.UNSUPPORTED_API, message: "unsupport api:" + api }; }
  var FBHelper = { emptyWait: (fail) => new Promise((r,j) => fail ? j(new Error("fail")) : r()), emptyWaitObject: (o) => Promise.resolve(o), emptyWaitBool: (b) => Promise.resolve(b), emptyWaitString: (s) => Promise.resolve(s), emptyWaitError: (e) => Promise.reject(e), emptyWaitUnsupportApi: (a) => Promise.reject(newUnsupportAPIError(a)), generateId: () => Date.now().toString(36) + Math.random().toString(36).slice(2,11) };
  class Context {
      constructor(id=null, type="SOLO") { this._sId=id; this._sType=type; }
      static get currentContext() { if(!this._c) this._c=new Context(); return this._c; }
      static set currentContext(c) { this._c=c; }
      getID() { return this._sId; }
      getType() { return this._sType; }
      isSizeBetween(min,max) { return {answer:false, minSize:min||0, maxSize:max||0}; }
      switchAsync(id, silent) { this._sId=id; return FBHelper.emptyWaitObject(null); }
      chooseAsync(o) { return FBHelper.emptyWaitUnsupportApi("context.chooseAsync"); }
      createAsync(p) { return FBHelper.emptyWaitUnsupportApi("context.createAsync"); }
      getPlayersAsync() { return FBHelper.emptyWaitObject([]); }
  }
  class SignedPlayerInfo { constructor(id,s){this._id=id;this._s=s;} getPlayerID(){return this._id;} getSignature(){return this._s;} }
  let STORE_KEY="_minigame_data_", _localData={}, _inited=false;
  function initCache(suf="") { if(_inited) return; _inited=true; STORE_KEY+=suf; try{ const d=localStorage.getItem(STORE_KEY); if(d) _localData=JSON.parse(d); }catch(e){} }
  function getItem(k,dv){ if(!k||!k.trim()) throw {code:CODE.INVALID_PARAM,message:"Invalid key"}; return _localData[k]!==undefined?_localData[k]:dv; }
  function setItem(k,v){ if(!k||!k.trim()) throw {code:CODE.INVALID_PARAM,message:"Invalid key"}; _localData[k]=v; }
  function flushCache(){ try{ localStorage.setItem(STORE_KEY,JSON.stringify(_localData)); localStorage.flush&&localStorage.flush(); }catch(e){} }
  const MiniGameSDK = {
      init(cb){ initCache(); cb&&cb(); },
      setGameReadyAsync(){ console.log("GameReady"); },
      pauseSound: null,
      resumeSound: null,
      showInterstitial(cb){ console.log("showInterstitial"); cb&&cb({code:CODE.OK}); },
      showRewardedVideo(cb){ console.log("showRewardedVideo"); cb&&cb(true); },
      showBanner(){ console.log("showBanner"); },
      hideBanner(){ console.log("hideBanner"); },
      Context,
      SignedPlayerInfo,
      getDataAsync(ks){ return FBHelper.emptyWaitObject(ks.reduce((a,k)=>{a[k]=getItem(k,null);return a;},{})); },
      setDataAsync(d){ Object.entries(d).forEach(([k,v])=>setItem(k,v)); flushCache(); return FBHelper.emptyWaitBool(true); },
      onPause(cb){ window.addEventListener("blur",cb); },
      onResume(cb){ window.addEventListener("focus",cb); }
  };
  window.MiniGameSDK = MiniGameSDK;
  window.FBInstant = {
      getContext: () => Context.currentContext,
      getSignedPlayerInfoAsync: () => FBHelper.emptyWaitObject(new SignedPlayerInfo("test","sig")),
      getDataAsync: MiniGameSDK.getDataAsync,
      setDataAsync: MiniGameSDK.setDataAsync,
      onPause: MiniGameSDK.onPause,
      onResume: MiniGameSDK.onResume
  };
  return MiniGameSDK;
})();
