console.log('daycarestuff.js loaded');

const nftAddress = '0x08533a2b16e3db03eebd5b23210122f97dfcb97d';
const daycareAddress = '0xd32247484111569930a0b9c7e669e8E108392496';
const backendUrl = 'https://sketchyflipback.onrender.com';
const chainId = '0xaad';

const nftABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function approve(address to, uint256 tokenId)"
];

const daycareABI = [{"inputs":[{"internalType":"address","name":"_nftAddress","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"inputs":[],"name":"ReentrancyGuardReentrantCall","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Claimed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"startTime","type":"uint256"}],"name":"DroppedOff","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"PickedUp","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"PointsAdded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"PointsBurned","type":"event"},{"anonymous":false,"inputs":[],"name":"PointsEditingLocked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"}],"name":"UserAdded","type":"event"},{"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"addPoints","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address[]","name":"users","type":"address[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"name":"addPointsBatch","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"burnPoints","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256[]","name":"daycareIndices","type":"uint256[]"}],"name":"claimMultiple","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"daycareIndex","type":"uint256"}],"name":"claimPoints","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"daycares","outputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"claimedPoints","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"dropOff","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256[]","name":"tokenIds","type":"uint256[]"}],"name":"dropOffMultiple","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getDaycares","outputs":[{"components":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"claimedPoints","type":"uint256"}],"internalType":"struct MymilioDaycare.DaycareInfo[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getLeaderboard","outputs":[{"internalType":"address[]","name":"","type":"address[]"},{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"uint256","name":"daycareIndex","type":"uint256"}],"name":"getPendingPoints","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getTotalPoints","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"lockPointsEditing","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"nft","outputs":[{"internalType":"contract IERC721","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"daycareIndex","type":"uint256"}],"name":"pickUp","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256[]","name":"daycareIndices","type":"uint256[]"}],"name":"pickUpMultiple","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"points","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pointsEditingLocked","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pointsPerDay","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"userAddresses","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}];

let provider, signer, account, nftContract, daycareContract;
let socket = io(backendUrl);
let selectedTokenIds = [];
let stakedTokenIds = [];
let stakedCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('nftModal');
    if (modal) modal.style.display = 'none';
    const videoOverlay = document.getElementById('videoOverlay');
    if (videoOverlay) videoOverlay.style.display = 'none';
    document.getElementById('loadingScreen').classList.add('hidden');
});

function showLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) loadingScreen.classList.remove('hidden');
}
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) loadingScreen.classList.add('hidden');
}

// FIX: NFT Loading now a function (not inline)
async function loadNFTs() {
    if (!nftContract || !account) {
        alert("Please connect your wallet first!");
        return;
    }
    try {
        const balance = await nftContract.balanceOf(account);
        const nftGrid = document.getElementById('nftGrid');
        if (nftGrid) {
            nftGrid.innerHTML = '';
            selectedTokenIds = [];
            if (balance == 0) {
                nftGrid.innerHTML = '<p class="text-xs text-center opacity-70">No NFTs available to stake</p>';
            } else {
                for (let i = 0; i < balance; i++) {
                    const tokenId = await nftContract.tokenOfOwnerByIndex(account, i);
                    if (stakedTokenIds.includes(tokenId.toString())) continue;
                    let uri = await nftContract.tokenURI(tokenId);
                    if (uri.startsWith('ipfs://')) uri = 'https://ipfs.io/ipfs/' + uri.slice(7);
                    try {
                        const response = await fetch(uri);
                        const metadata = await response.json();
                        const image = metadata.image.startsWith('ipfs://') ? 'https://ipfs.io/ipfs/' + metadata.image.slice(7) : metadata.image;
                        const div = document.createElement('div');
                        div.className = 'p-1';
                        div.innerHTML = `
                            <img src="${image}" alt="NFT #${tokenId}" class="w-full h-auto rounded border border-orange-500">
                            <p class="text-xs text-center">#${tokenId}</p>
                            <input type="checkbox" class="select-checkbox mx-auto block" data-id="${tokenId}">
                        `;
                        nftGrid.appendChild(div);
                    } catch (error) {
                        console.error(`Failed to fetch metadata for token ${tokenId}:`, error);
                    }
                }
            }
            const modal = document.getElementById('nftModal');
            if (modal) modal.style.display = 'block';
            const selectMultipleBtn = document.getElementById('selectMultipleBtn');
            if (selectMultipleBtn) {
                selectMultipleBtn.addEventListener('click', selectMultiple, { once: true });
            } else {
                console.error('Select Multiple button not found');
            }
        } else {
            console.error('NFT grid not found');
        }
    } catch (error) {
        console.error('Error loading NFTs:', error);
        alert('Error loading NFTs: ' + error.message);
        throw error;
    }
}

// Event listeners
const stakeButton = document.getElementById('stakeButton');
if (stakeButton) {
    stakeButton.addEventListener('click', () => {
        document.getElementById('mainMenu').classList.add('hidden');
        document.getElementById('gameInterface').classList.add('hidden');
        document.getElementById('stakeContainer').classList.remove('hidden');
    });
}

const backButton = document.getElementById('backButton');
if (backButton) {
    backButton.addEventListener('click', () => {
        document.getElementById('stakeContainer').classList.add('hidden');
        document.getElementById('mainMenu').classList.remove('hidden');
    });
}

const homeButton = document.getElementById('homeButton');
if (homeButton) {
    homeButton.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
}

const connectWallet = document.getElementById('connectWallet');
if (connectWallet) {
    connectWallet.addEventListener('click', async () => {
        if (window.ethereum) {
            try {
                showLoadingScreen();
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                provider = new ethers.providers.Web3Provider(window.ethereum);
                signer = provider.getSigner();
                account = await signer.getAddress();
                document.getElementById('account').innerText = `Account: ${account.slice(0,6)}...${account.slice(-4)}`;
                const currentChain = await provider.getNetwork();
                if (currentChain.chainId !== 2741) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: chainId,
                            chainName: 'Abstract',
                            rpcUrls: ['https://api.mainnet.abs.xyz'],
                            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                            blockExplorerUrls: ['https://abscan.org']
                        }]
                    });
                }
                nftContract = new ethers.Contract(nftAddress, nftABI, signer);
                daycareContract = new ethers.Contract(daycareAddress, daycareABI, signer);
                socket.emit('registerAddress', { address: account });
                socket.emit('fetchUserDaycare', { account });
                document.getElementById('selectNFTBtn').disabled = false;
                document.getElementById('burnBtn').disabled = false;
            } catch (error) {
                alert(`Wallet connection failed: ${error.message || 'Unknown error'}`);
            } finally {
                hideLoadingScreen();
            }
        } else {
            alert('Please install MetaMask!');
        }
    });
}

// Socket listeners (unchanged)
socket.on('connect_error', (error) => {
    alert('Failed to connect to backend. Please try again later.');
});

socket.on('leaderboardUpdate', (data) => {
    const tableBody = document.getElementById('leaderboardBody');
    if (tableBody) {
        tableBody.innerHTML = '';
        data.forEach((entry, index) => {
            const row = `<tr><td class="border border-orange-500 p-1">${index + 1}</td><td class="border border-orange-500 p-1">${entry.address.slice(0,6)}...${entry.address.slice(-4)}</td><td class="border border-orange-500 p-1">${entry.points}</td></tr>`;
            tableBody.innerHTML += row;
        });
    }
});

socket.on('userDaycareUpdate', (data) => {
    const totalPoints = document.getElementById('totalPoints');
    if (totalPoints) {
        totalPoints.innerText = `Total Points: ${data.points}`;
    }
    const stakedList = document.getElementById('stakedNFTs');
    if (stakedList) {
        stakedList.innerHTML = '';
        stakedTokenIds = [];
        stakedCount = data.daycares.length;
        data.daycares.forEach((d, index) => {
            stakedTokenIds.push(d.tokenId);
            const item = `<div class="p-1 flex justify-between items-center border-b border-orange-200 last:border-b-0">
                <div class="flex items-center">
                    <img src="${d.image}" alt="NFT ${d.tokenId}" class="w-10 h-10 mr-2 rounded shadow border border-orange-500">
                    <div>
                        <span class="text-xs font-bold">NFT #${d.tokenId}</span><br>
                        <span class="text-xs opacity-70">Pending: ${d.pending} points</span>
                    </div>
                </div>
                <div class="flex gap-1">
                    <button class="neon-button text-xs px-2 py-1 claim-btn" data-index="${index}" ${d.pending == 0 ? 'disabled' : ''}>Claim</button>
                    <button class="neon-button text-xs px-2 py-1 pickup-btn" data-index="${index}">Pick Up</button>
                </div>
            </div>`;
            stakedList.innerHTML += item;
        });
        document.getElementById('claimAllButton').style.display = stakedCount > 0 ? 'block' : 'none';
        document.getElementById('pickUpAllButton').style.display = stakedCount > 0 ? 'block' : 'none';
        document.querySelectorAll('.claim-btn').forEach(btn => btn.addEventListener('click', claimPoints));
        document.querySelectorAll('.pickup-btn').forEach(btn => btn.addEventListener('click', pickUp));
    }
});

const refreshLeaderboard = document.getElementById('refreshLeaderboard');
if (refreshLeaderboard) {
    refreshLeaderboard.addEventListener('click', () => {
        socket.emit('refreshLeaderboard');
    });
}

const modal = document.getElementById('nftModal');
const closeModal = document.getElementsByClassName('close')[0];
if (closeModal) {
    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });
}
window.addEventListener('click', (event) => {
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});

// THIS IS NOW THE BUTTON THAT CALLS THE REUSABLE FUNCTION
const selectNFTBtn = document.getElementById('selectNFTBtn');
if (selectNFTBtn) {
    selectNFTBtn.addEventListener('click', async () => {
        showLoadingScreen();
        try {
            await loadNFTs();
        } catch (error) {
            alert('Error loading NFTs: ' + error.message);
        } finally {
            hideLoadingScreen();
        }
    });
}

function selectMultiple() {
    selectedTokenIds = Array.from(document.querySelectorAll('.select-checkbox:checked')).map(checkbox => checkbox.dataset.id);
    document.getElementById('nftModal').style.display = 'none';
    document.getElementById('selectedNFTs').textContent = selectedTokenIds.length > 0 ? `Selected: ${selectedTokenIds.join(', ')}` : 'No NFTs selected';
    document.getElementById('dropOffBtn').disabled = selectedTokenIds.length === 0;
}

const dropOffBtn = document.getElementById('dropOffBtn');
if (dropOffBtn) {
    dropOffBtn.addEventListener('click', async () => {
        if (selectedTokenIds.length === 0) {
            alert('Select NFTs first');
            return;
        }
        const button = document.getElementById('dropOffBtn');
        button.disabled = true;
        button.innerText = 'Processing...';
        showLoadingScreen();
        try {
            for (let tokenId of selectedTokenIds) {
                await nftContract.approve(daycareAddress, tokenId);
            }
            const tx = await daycareContract.dropOffMultiple(selectedTokenIds);
            await tx.wait();
            alert('Staked successfully!');
            selectedTokenIds = [];
            document.getElementById('selectedNFTs').innerText = 'No NFTs selected';
            document.getElementById('dropOffBtn').disabled = true;
            socket.emit('fetchUserDaycare', { account });
        } catch (error) {
            alert('Staking failed: ' + error.message);
        } finally {
            button.disabled = false;
            button.innerText = '🎰 Stake Selected NFTs';
            hideLoadingScreen();
        }
    });
}

async function claimPoints(e) {
    const index = e.target.dataset.index;
    const button = e.target;
    button.disabled = true;
    button.innerText = 'Processing...';
    showLoadingScreen();
    try {
        const tx = await daycareContract.claimPoints(index);
        await tx.wait();
        alert('Claimed!');
        socket.emit('fetchUserDaycare', { account });
    } catch (error) {
        alert('Claim failed: ' + error.message);
    } finally {
        button.disabled = false;
        button.innerText = 'Claim';
        hideLoadingScreen();
    }
}

async function pickUp(e) {
    const index = e.target.dataset.index;
    const button = e.target;
    button.disabled = true;
    button.innerText = 'Processing...';
    showLoadingScreen();
    try {
        const tx = await daycareContract.pickUp(index);
        await tx.wait();
        alert('Picked up!');
        socket.emit('fetchUserDaycare', { account });
    } catch (error) {
        alert('Pick up failed: ' + error.message);
    } finally {
        button.disabled = false;
        button.innerText = 'Pick Up';
        hideLoadingScreen();
    }
}

const claimAllButton = document.getElementById('claimAllButton');
if (claimAllButton) {
    claimAllButton.addEventListener('click', async () => {
        if (stakedCount === 0) return;
        const button = document.getElementById('claimAllButton');
        button.disabled = true;
        button.innerText = 'Processing...';
        showLoadingScreen();
        try {
            const indices = Array.from({length: stakedCount}, (_, i) => i);
            const tx = await daycareContract.claimMultiple(indices);
            await tx.wait();
            alert('Claimed all!');
            socket.emit('fetchUserDaycare', { account });
        } catch (error) {
            alert('Claim all failed: ' + error.message);
        } finally {
            button.disabled = false;
            button.innerText = 'Claim All';
            hideLoadingScreen();
        }
    });
}

const pickUpAllButton = document.getElementById('pickUpAllButton');
if (pickUpAllButton) {
    pickUpAllButton.addEventListener('click', async () => {
        if (stakedCount === 0) return;
        const button = document.getElementById('pickUpAllButton');
        button.disabled = true;
        button.innerText = 'Processing...';
        showLoadingScreen();
        try {
            const indices = Array.from({length: stakedCount}, (_, i) => i);
            const tx = await daycareContract.pickUpMultiple(indices);
            await tx.wait();
            alert('Picked up all!');
            socket.emit('fetchUserDaycare', { account });
        } catch (error) {
            alert('Pick up all failed: ' + error.message);
        } finally {
            button.disabled = false;
            button.innerText = 'Pick Up All';
            hideLoadingScreen();
        }
    });
}

const burnBtn = document.getElementById('burnBtn');
if (burnBtn) {
    burnBtn.addEventListener('click', async () => {
        const amount = document.getElementById('burnAmount').value;
        if (!amount || amount <= 0) {
            alert('Enter valid amount');
            return;
        }
        const button = document.getElementById('burnBtn');
        button.disabled = true;
        button.innerText = 'Processing...';
        showLoadingScreen();
        try {
            const tx = await daycareContract.burnPoints(amount);
            await tx.wait();
            alert('Burned!');
            socket.emit('fetchUserDaycare', { account });
            document.getElementById('burnAmount').value = '';
        } catch (error) {
            alert('Burn failed: ' + error.message);
        } finally {
            button.disabled = false;
            button.innerText = 'Burn Points';
            hideLoadingScreen();
        }
    });
}
