// Constants
const nftAddress = '0x08533a2b16e3db03eebd5b23210122f97dfcb97d';
const daycareAddress = '0xd32247484111569930a0b9c7e669e8E108392496';
const backendUrl = 'https://sketchyflipback.onrender.com'; // Replace with your Render URL
const chainId = '0xaad'; // 2741 in hex for Abstract chain

const nftABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function approve(address to, uint256 tokenId)"
];

const daycareABI = [{"inputs":[{"internalType":"address","name":"_nftAddress","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"inputs":[],"name":"ReentrancyGuardReentrantCall","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Claimed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"startTime","type":"uint256"}],"name":"DroppedOff","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"PickedUp","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"PointsAdded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"PointsBurned","type":"event"},{"anonymous":false,"inputs":[],"name":"PointsEditingLocked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"}],"name":"UserAdded","type":"event"},{"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"addPoints","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address[]","name":"users","type":"address[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"name":"addPointsBatch","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"burnPoints","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256[]","name":"daycareIndices","type":"uint256[]"}],"name":"claimMultiple","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"daycareIndex","type":"uint256"}],"name":"claimPoints","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"daycares","outputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"claimedPoints","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"dropOff","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256[]","name":"tokenIds","type":"uint256[]"}],"name":"dropOffMultiple","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getDaycares","outputs":[{"components":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"claimedPoints","type":"uint256"}],"internalType":"struct MymilioDaycare.DaycareInfo[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getLeaderboard","outputs":[{"internalType":"address[]","name":"","type":"address[]"},{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"uint256","name":"daycareIndex","type":"uint256"}],"name":"getPendingPoints","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getTotalPoints","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"lockPointsEditing","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"nft","outputs":[{"internalType":"contract IERC721","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"daycareIndex","type":"uint256"}],"name":"pickUp","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256[]","name":"daycareIndices","type":"uint256[]"}],"name":"pickUpMultiple","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"points","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pointsEditingLocked","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pointsPerDay","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"userAddresses","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}];

// Global variables
let provider, signer, account, nftContract, daycareContract;
let socket = io(backendUrl);
let selectedTokenIds = [];
let stakedTokenIds = [];
let stakedCount = 0;

// Event listeners from original
document.getElementById('stakeButton').addEventListener('click', () => {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('gameInterface').classList.add('hidden');
    document.getElementById('stakeContainer').classList.remove('hidden');
});

document.getElementById('backButton').addEventListener('click', () => {
    document.getElementById('stakeContainer').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
});

// Connect wallet
document.getElementById('connectWallet').addEventListener('click', async () => {
    if (window.ethereum) {
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
            account = await signer.getAddress();
            document.getElementById('accountDisplay').innerText = `Account: ${account.slice(0,6)}...${account.slice(-4)}`;

            // Check/switch chain
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

            // Init contracts
            nftContract = new ethers.Contract(nftAddress, nftABI, signer);
            daycareContract = new ethers.Contract(daycareAddress, daycareABI, signer);

            // Register with backend
            socket.emit('registerAddress', { address: account });

            // Fetch user data
            socket.emit('fetchUserDaycare', { account });

        } catch (error) {
            alert('Wallet connection failed: ' + error.message);
        }
    } else {
        alert('Please install MetaMask!');
    }
});

// Socket listeners
socket.on('leaderboardUpdate', (data) => {
    const tableBody = document.getElementById('leaderboardTable');
    tableBody.innerHTML = '';
    data.forEach((entry, index) => {
        const row = `<tr><td>${index + 1}</td><td>${entry.address.slice(0,6)}...${entry.address.slice(-4)}</td><td>${entry.points}</td></tr>`;
        tableBody.innerHTML += row;
    });
});

socket.on('userDaycareUpdate', (data) => {
    document.getElementById('totalPoints').innerText = `Total Points: ${data.points}`;
    const stakedList = document.getElementById('stakedList');
    stakedList.innerHTML = '';
    stakedTokenIds = [];
    stakedCount = data.daycares.length;
    data.daycares.forEach((d, index) => {
        stakedTokenIds.push(d.tokenId);
        const item = `<div>
            <img src="${d.image}" alt="NFT ${d.tokenId}" width="100">
            <p>Token ID: ${d.tokenId}</p>
            <p>Pending Points: ${d.pending}</p>
            <button onclick="claimPoints(${index})">Claim</button>
            <button onclick="pickUp(${index})">Pick Up</button>
        </div>`;
        stakedList.innerHTML += item;
    });
    document.getElementById('claimAllButton').style.display = stakedCount > 0 ? 'block' : 'none';
    document.getElementById('pickUpAllButton').style.display = stakedCount > 0 ? 'block' : 'none';
});

// Refresh leaderboard
document.getElementById('refreshLeaderboard').addEventListener('click', () => {
    // Assuming backend has a 'refreshLeaderboard' event to trigger fetch
    socket.emit('refreshLeaderboard');
    // Or just wait for next poll
});

// Select NFTs modal
const modal = document.getElementById('nftModal');
const closeModal = document.getElementsByClassName('close')[0];
closeModal.onclick = () => { modal.style.display = 'none'; };

document.getElementById('selectNFTsButton').addEventListener('click', async () => {
    if (!account) return alert('Connect wallet first');
    try {
        const balance = await nftContract.balanceOf(account);
        const nftList = document.getElementById('nftList');
        nftList.innerHTML = '';
        selectedTokenIds = [];
        for (let i = 0; i < balance; i++) {
            const tokenId = await nftContract.tokenOfOwnerByIndex(account, i);
            if (stakedTokenIds.includes(tokenId.toString())) continue; // Skip staked
            let uri = await nftContract.tokenURI(tokenId);
            if (uri.startsWith('ipfs://')) uri = 'https://ipfs.io/ipfs/' + uri.slice(7);
            const response = await fetch(uri);
            const metadata = await response.json();
            const image = metadata.image.startsWith('ipfs://') ? 'https://ipfs.io/ipfs/' + metadata.image.slice(7) : metadata.image;
            const checkbox = `<input type="checkbox" value="${tokenId}" onchange="toggleSelect(${tokenId})">
                <img src="${image}" alt="NFT ${tokenId}" width="50"> Token ${tokenId}<br>`;
            nftList.innerHTML += checkbox;
        }
        modal.style.display = 'block';
    } catch (error) {
        alert('Error loading NFTs: ' + error.message);
    }
});

function toggleSelect(tokenId) {
    if (selectedTokenIds.includes(tokenId.toString())) {
        selectedTokenIds = selectedTokenIds.filter(id => id !== tokenId.toString());
    } else {
        selectedTokenIds.push(tokenId.toString());
    }
    document.getElementById('selectedNFTs').innerText = `Selected: ${selectedTokenIds.length} NFTs`;
}

document.getElementById('confirmSelection').addEventListener('click', () => {
    modal.style.display = 'none';
});

// Stake selected
document.getElementById('stakeSelectedButton').addEventListener('click', async () => {
    if (selectedTokenIds.length === 0) return alert('Select NFTs first');
    const button = document.getElementById('stakeSelectedButton');
    button.disabled = true;
    button.innerText = 'Processing...';
    try {
        // Approve all selected to daycare
        for (let tokenId of selectedTokenIds) {
            await nftContract.approve(daycareAddress, tokenId);
        }
        const tx = await daycareContract.dropOffMultiple(selectedTokenIds);
        await tx.wait();
        alert('Staked successfully!');
        selectedTokenIds = [];
        document.getElementById('selectedNFTs').innerText = 'No NFTs selected';
        socket.emit('fetchUserDaycare', { account }); // Refresh
    } catch (error) {
        alert('Staking failed: ' + error.message);
    } finally {
        button.disabled = false;
        button.innerText = '🎰 Stake Selected NFTs';
    }
});

// Claim points (per index)
async function claimPoints(index) {
    const button = event.target;
    button.disabled = true;
    button.innerText = 'Processing...';
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
    }
}

// Pick up (per index)
async function pickUp(index) {
    const button = event.target;
    button.disabled = true;
    button.innerText = 'Processing...';
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
    }
}

// Claim all
document.getElementById('claimAllButton').addEventListener('click', async () => {
    if (stakedCount === 0) return;
    const button = document.getElementById('claimAllButton');
    button.disabled = true;
    button.innerText = 'Processing...';
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
    }
});

// Pick up all
document.getElementById('pickUpAllButton').addEventListener('click', async () => {
    if (stakedCount === 0) return;
    const button = document.getElementById('pickUpAllButton');
    button.disabled = true;
    button.innerText = 'Processing...';
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
    }
});

// Burn points
document.getElementById('burnButton').addEventListener('click', async () => {
    const amount = document.getElementById('burnAmount').value;
    if (!amount || amount <= 0) return alert('Enter valid amount');
    const button = document.getElementById('burnButton');
    button.disabled = true;
    button.innerText = 'Processing...';
    try {
        const tx = await daycareContract.burnPoints(amount);
        await tx.wait();
        alert('Burned!');
        socket.emit('fetchUserDaycare', { account });
    } catch (error) {
        alert('Burn failed: ' + error.message);
    } finally {
        button.disabled = false;
        button.innerText = 'Burn Points';
    }
});