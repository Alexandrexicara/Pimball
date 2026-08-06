(function() {
    'use strict';

    // Ad configuration from config.json
    const AD_CONFIG = {
        interstitial: "4864743603539728_5070034729677280",
        banner: "4864743603539728_5082905605056859",
        rewarded_video: "4864743603539728_5070034119677341",
        rewarded_interstitial: "4864743603539728_5070034119677341"
    };

    let _fbInstantInitialized = false;
    let _preloadedInterstitial = null;
    let _preloadedRewarded = null;

    // Initialize Facebook Instant Games SDK
    function initFBInstant() {
        if (typeof FBInstant !== 'undefined' && !_fbInstantInitialized) {
            FBInstant.initializeAsync()
                .then(() => {
                    console.log('FB Instant SDK initialized');
                    _fbInstantInitialized = true;
                    
                    // Preload ads
                    preloadInterstitial();
                    preloadRewarded();
                })
                .catch(err => {
                    console.error('FB Instant initialization failed:', err);
                });
        }
    }

    function preloadInterstitial() {
        if (typeof FBInstant !== 'undefined' && _fbInstantInitialized) {
            FBInstant.getInterstitialAdAsync(AD_CONFIG.interstitial)
                .then(interstitial => {
                    _preloadedInterstitial = interstitial;
                    return interstitial.loadAsync();
                })
                .then(() => {
                    console.log('Interstitial ad preloaded');
                })
                .catch(err => {
                    console.warn('Failed to preload interstitial:', err);
                });
        }
    }

    function preloadRewarded() {
        if (typeof FBInstant !== 'undefined' && _fbInstantInitialized) {
            FBInstant.getRewardedVideoAsync(AD_CONFIG.rewarded_video)
                .then(rewarded => {
                    _preloadedRewarded = rewarded;
                    return rewarded.loadAsync();
                })
                .then(() => {
                    console.log('Rewarded video ad preloaded');
                })
                .catch(err => {
                    console.warn('Failed to preload rewarded:', err);
                });
        }
    }

    // Local storage for game data
    let STORE_KEY = "_minigame_data_";
    let _localData = {};
    let _inited = false;

    function initCache() {
        if (_inited) return;
        _inited = true;
        try {
            const d = localStorage.getItem(STORE_KEY);
            if (d) _localData = JSON.parse(d);
        } catch (e) {}
    }

    function getItem(k, dv) {
        if (!k || !k.trim()) throw { code: "INVALID_PARAM", message: "Invalid key" };
        return _localData[k] !== undefined ? _localData[k] : dv;
    }

    function setItem(k, v) {
        if (!k || !k.trim()) throw { code: "INVALID_PARAM", message: "Invalid key" };
        _localData[k] = v;
    }

    function flushCache() {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(_localData));
        } catch (e) {}
    }

    const MiniGameSDK = {
        init(cb) {
            initCache();
            initFBInstant();
            console.log("MiniGameSDK initialized");
            cb && cb();
        },

        setGameReadyAsync() {
            if (typeof FBInstant !== 'undefined' && _fbInstantInitialized) {
                FBInstant.startGameAsync()
                    .then(() => console.log('Game started'))
                    .catch(err => console.error('Failed to start game:', err));
            } else {
                console.log("GameReady (FBInstant not available)");
            }
        },

        pauseSound: null,
        resumeSound: null,

        showInterstitial(cb) {
            console.log("showInterstitial called");
            
            if (typeof FBInstant !== 'undefined' && _fbInstantInitialized && _preloadedInterstitial) {
                _preloadedInterstitial.showAsync()
                    .then(() => {
                        console.log('Interstitial ad shown');
                        cb && cb({ code: "OK" });
                        // Preload next ad
                        preloadInterstitial();
                    })
                    .catch(err => {
                        console.warn('Failed to show interstitial:', err);
                        cb && cb({ code: "AD_LOAD_FAILED", message: err.message });
                    });
            } else {
                console.warn('FBInstant not available or ad not preloaded');
                cb && cb({ code: "OK" }); // Continue without ad
            }
        },

        showRewardedVideo(cb) {
            console.log("showRewardedVideo called");
            
            if (typeof FBInstant !== 'undefined' && _fbInstantInitialized && _preloadedRewarded) {
                _preloadedRewarded.showAsync()
                    .then(() => {
                        console.log('Rewarded video shown');
                        cb && cb(true);
                        // Preload next ad
                        preloadRewarded();
                    })
                    .catch(err => {
                        console.warn('Failed to show rewarded:', err);
                        cb && cb(false);
                    });
            } else {
                console.warn('FBInstant not available or rewarded not preloaded');
                cb && cb(true); // Grant reward anyway for testing
            }
        },

        showBanner() {
            console.log("showBanner called");
            // Banner ads not fully supported in FB Instant, but we can try
            if (typeof FBInstant !== 'undefined' && _fbInstantInitialized) {
                // FB Instant doesn't have banner ads, but we log for compatibility
                console.log('Banner ads not supported in FB Instant');
            }
        },

        hideBanner() {
            console.log("hideBanner called");
        },

        getDataAsync(ks) {
            return Promise.resolve(ks.reduce((a, k) => {
                a[k] = getItem(k, null);
                return a;
            }, {}));
        },

        setDataAsync(d) {
            Object.entries(d).forEach(([k, v]) => setItem(k, v));
            flushCache();
            return Promise.resolve(true);
        },

        onPause(cb) {
            window.addEventListener("blur", cb);
        },

        onResume(cb) {
            window.addEventListener("focus", cb);
        }
    };

    window.MiniGameSDK = MiniGameSDK;

    // Also expose FBInstant compatibility
    window.FBInstant = window.FBInstant || {
        initializeAsync: () => Promise.resolve(),
        startGameAsync: () => Promise.resolve(),
        getInterstitialAdAsync: (id) => Promise.resolve({ loadAsync: () => Promise.resolve(), showAsync: () => Promise.resolve() }),
        getRewardedVideoAsync: (id) => Promise.resolve({ loadAsync: () => Promise.resolve(), showAsync: () => Promise.resolve() }),
        getContext: () => ({ getID: () => "test", getType: () => "SOLO" }),
        getSignedPlayerInfoAsync: () => Promise.resolve({ getPlayerID: () => "test", getSignature: () => "sig" }),
        getDataAsync: MiniGameSDK.getDataAsync,
        setDataAsync: MiniGameSDK.setDataAsync,
        onPause: MiniGameSDK.onPause,
        onResume: MiniGameSDK.onResume
    };

    // Auto-initialize if FBInstant script is already loaded
    if (typeof FBInstant !== 'undefined') {
        initFBInstant();
    }

    return MiniGameSDK;
})();
