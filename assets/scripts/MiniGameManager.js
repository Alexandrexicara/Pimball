const MiniGameManager = cc.Class({
    extends: cc.Component,

    onLoad() {
        MiniGameSDK.init(() => {
            console.log("SDK CARREGADO");
        });

        MiniGameSDK.pauseSound = () => cc.audioEngine.pauseAll();
        MiniGameSDK.resumeSound = () => cc.audioEngine.resumeAll();

        MiniGameSDK.setGameReadyAsync();
    },

    mostrarIntersticial() {
        MiniGameSDK.showInterstitial();
    },

    mostrarRecompensa() {
        MiniGameSDK.showRewardedVideo((ok) => {
            if (ok) { /* DAR PREMIO */ }
        });
    },

    mostrarBanner() { MiniGameSDK.showBanner(); },
    esconderBanner() { MiniGameSDK.hideBanner(); }
});

module.exports = MiniGameManager;
